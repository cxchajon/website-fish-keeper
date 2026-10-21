/**
 * Security-critical request handling for the signed Cloudinary authorizer.
 *
 * This module deliberately contains no Cloudflare runtime-only imports so its
 * boundary validation and signing contract can be tested with isolated mocks.
 * The production entry point supplies the actual DurableObject base class.
 */

const ALLOWED_ORIGINS = new Set([
  'https://thetankguide.com',
  'https://www.thetankguide.com'
]);

const ALLOWED_HOSTNAMES = new Set([
  'thetankguide.com',
  'www.thetankguide.com'
]);

export const CLOUDINARY_CLOUD_NAME = 'fishkeepinglifeco';
export const CLOUDINARY_UPLOAD_PRESET = 'feature-your-tank-signed-v1';
export const TURNSTILE_ACTION = 'ttg_upload_authorize';
export const SESSION_TTL_MS = 10 * 60 * 1000;
export const MAX_UPLOADS_PER_SESSION = 5;

const MAX_JSON_BYTES = 4_096;
const MAX_TIMESTAMP_SKEW_SECONDS = 120;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{20,96}$/;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: true });

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value, allowedKeys) {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Pragma': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin'
  };
}

function response(body, status, origin, extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Pragma': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders
  };

  if (origin) Object.assign(headers, corsHeaders(origin));
  return new Response(JSON.stringify(body), { status, headers });
}

function genericError(status, origin) {
  const message = status === 429
    ? 'Too many requests. Please try again later.'
    : status === 503
      ? 'Upload authorization is temporarily unavailable.'
      : 'Upload authorization failed.';
  return response({ ok: false, error: message }, status, origin);
}

function requiredBindingsPresent(env) {
  return Boolean(
    env.CLOUDINARY_API_KEY &&
    env.CLOUDINARY_API_SECRET &&
    env.TURNSTILE_SECRET_KEY &&
    env.UPLOAD_SESSIONS &&
    env.UPLOAD_AUTH_RATE_LIMITER &&
    env.UPLOAD_SIGN_RATE_LIMITER
  );
}

function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

async function readJson(request) {
  const contentType = (request.headers.get('Content-Type') || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== 'application/json') return null;

  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (!Number.isFinite(declaredLength) || declaredLength > MAX_JSON_BYTES) return null;

  let bytes;
  try {
    bytes = new Uint8Array(await request.arrayBuffer());
  } catch {
    return null;
  }

  if (bytes.byteLength > MAX_JSON_BYTES) return null;

  try {
    const parsed = JSON.parse(textDecoder.decode(bytes));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function randomPublicId(batchId) {
  // Avoid original file names and personal data in a public identifier.
  return `feature-${batchId}-${randomToken(18)}`;
}

async function digestHex(algorithm, value) {
  const digest = await crypto.subtle.digest(algorithm, textEncoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(value) {
  return digestHex('SHA-256', value);
}

function signatureValue(value) {
  if (Array.isArray(value)) return value.join(',');
  return String(value);
}

export async function cloudinarySignature(params, apiSecret) {
  // Cloudinary excludes these transport parameters from an upload signature.
  const excluded = new Set(['api_key', 'cloud_name', 'file', 'resource_type', 'signature']);
  const canonical = Object.entries(params)
    .filter(([key, value]) => !excluded.has(key) && value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${signatureValue(value)}`)
    .join('&');

  return digestHex('SHA-1', `${canonical}${apiSecret}`);
}

async function verifyTurnstile(token, request, env, fetchImpl) {
  const form = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
    remoteip: getClientIp(request)
  });

  let verification;
  try {
    const result = await fetchImpl('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form
    });
    if (!result.ok) return false;
    verification = await result.json();
  } catch {
    return false;
  }

  return Boolean(
    verification &&
    verification.success === true &&
    ALLOWED_HOSTNAMES.has(verification.hostname) &&
    verification.action === TURNSTILE_ACTION
  );
}

function sessionStub(env, sessionId) {
  if (typeof sessionId !== 'string' || sessionId.length < 20 || sessionId.length > 128) return null;
  try {
    return env.UPLOAD_SESSIONS.get(env.UPLOAD_SESSIONS.idFromString(sessionId));
  } catch {
    return null;
  }
}

async function callSession(stub, path, body) {
  const result = await stub.fetch(`https://upload-session.internal${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  let data = null;
  try {
    data = await result.json();
  } catch {
    // Fail closed if the private session service returns a malformed response.
  }
  return { status: result.status, data };
}

async function enforceRateLimit(binding, key) {
  if (!binding || typeof binding.limit !== 'function') return null;
  try {
    return await binding.limit({ key });
  } catch {
    return null;
  }
}

function uploadParams(publicId, batchId, timestamp) {
  const tags = ['tank-submission', 'ttg-pending', `ttg-batch-${batchId}`];
  const context = `ttg_batch=${batchId}|ttg_state=pending`;

  // The signed preset owns Dynamic Folder placement. The Upload Widget's
  // callback contract cannot set asset_folder or public_id_prefix.
  const paramsToSign = {
    context,
    overwrite: 'false',
    public_id: publicId,
    source: 'uw',
    tags,
    timestamp: String(timestamp),
    upload_preset: CLOUDINARY_UPLOAD_PRESET
  };

  return {
    paramsToSign,
    widgetParams: {
      context,
      overwrite: false,
      publicId,
      resourceType: 'image',
      tags,
      uploadPreset: CLOUDINARY_UPLOAD_PRESET,
      uploadSignatureTimestamp: timestamp
    }
  };
}

async function authorize(request, env, origin, options) {
  if (!requiredBindingsPresent(env)) return genericError(503, origin);

  const rateLimit = await enforceRateLimit(env.UPLOAD_AUTH_RATE_LIMITER, `upload-auth:${getClientIp(request)}`);
  if (!rateLimit) return genericError(503, origin);
  if (!rateLimit.success) return genericError(429, origin);

  const body = await readJson(request);
  if (!body || !hasOnlyKeys(body, new Set(['turnstileToken']))) return genericError(400, origin);
  const token = typeof body.turnstileToken === 'string' ? body.turnstileToken.trim() : '';
  if (!token || token.length > 2_048) return genericError(400, origin);

  const verified = await verifyTurnstile(token, request, env, options.fetchImpl);
  if (!verified) return genericError(400, origin);

  const sessionToken = randomToken();
  const batchId = randomToken(12);
  const now = options.nowMs();
  const expiresAt = now + SESSION_TTL_MS;
  const objectId = env.UPLOAD_SESSIONS.newUniqueId();
  const stub = env.UPLOAD_SESSIONS.get(objectId);
  const initialized = await callSession(stub, '/initialize', {
    batchId,
    expiresAt,
    maxUploads: MAX_UPLOADS_PER_SESSION,
    sessionTokenHash: await sha256Hex(sessionToken)
  });

  if (initialized.status !== 201 || !initialized.data?.ok) return genericError(503, origin);

  return response({
    ok: true,
    session: {
      id: objectId.toString(),
      token: sessionToken,
      expiresAt,
      maxUploads: MAX_UPLOADS_PER_SESSION
    }
  }, 201, origin);
}

async function prepareSignature(request, env, origin, options) {
  if (!requiredBindingsPresent(env)) return genericError(503, origin);

  const rateLimit = await enforceRateLimit(env.UPLOAD_SIGN_RATE_LIMITER, `upload-sign:${getClientIp(request)}`);
  if (!rateLimit) return genericError(503, origin);
  if (!rateLimit.success) return genericError(429, origin);

  const body = await readJson(request);
  const keys = new Set(['requestId', 'sessionId', 'sessionToken', 'source', 'timestamp']);
  if (!body || !hasOnlyKeys(body, keys)) return genericError(400, origin);

  const timestamp = body.timestamp;
  const nowSeconds = Math.floor(options.nowMs() / 1_000);
  if (
    typeof body.sessionToken !== 'string' ||
    body.sessionToken.length < 40 ||
    body.sessionToken.length > 128 ||
    typeof body.requestId !== 'string' ||
    !REQUEST_ID_PATTERN.test(body.requestId) ||
    body.source !== 'uw' ||
    !Number.isInteger(timestamp) ||
    Math.abs(nowSeconds - timestamp) > MAX_TIMESTAMP_SKEW_SECONDS
  ) {
    return genericError(400, origin);
  }

  const stub = sessionStub(env, body.sessionId);
  if (!stub) return genericError(400, origin);

  // A request ID is an opaque, client-generated idempotency key. It never
  // becomes a Cloudinary public ID. The DO maps it to one server-generated ID
  // and only increments the five-upload counter on first use.
  const claimed = await callSession(stub, '/claim', {
    now: options.nowMs(),
    requestId: body.requestId,
    sessionTokenHash: await sha256Hex(body.sessionToken)
  });

  if (claimed.status === 429) return genericError(429, origin);
  if (claimed.status !== 200 || !claimed.data?.ok) return genericError(400, origin);

  const generated = uploadParams(claimed.data.publicId, claimed.data.batchId, timestamp);
  const signature = await cloudinarySignature(generated.paramsToSign, env.CLOUDINARY_API_SECRET);

  return response({
    ok: true,
    cloudName: CLOUDINARY_CLOUD_NAME,
    uploadParams: {
      apiKey: env.CLOUDINARY_API_KEY,
      signature,
      ...generated.widgetParams
    }
  }, 200, origin);
}

export async function handleRequest(request, env, options = {}) {
  const origin = request.headers.get('Origin') || '';
  if (!ALLOWED_ORIGINS.has(origin)) return genericError(403);

  const url = new URL(request.url);
  const knownPath = url.pathname === '/authorize' || url.pathname === '/prepare';
  if (!knownPath) return genericError(404, origin);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== 'POST') {
    return response({ ok: false, error: 'Not found.' }, 405, origin, { Allow: 'POST, OPTIONS' });
  }

  const runtime = {
    fetchImpl: options.fetchImpl || fetch,
    nowMs: options.nowMs || (() => Date.now())
  };

  return url.pathname === '/authorize'
    ? authorize(request, env, origin, runtime)
    : prepareSignature(request, env, origin, runtime);
}

/**
 * Defines the private session Durable Object using the real Workers base class
 * in production and a test base class in isolated unit tests.
 */
export function createUploadSessionClass(DurableObjectBase) {
  return class UploadSession extends DurableObjectBase {
    constructor(ctx, env) {
      super(ctx, env);
      this.ctx = ctx;
      this.sql = ctx.storage.sql;
      this.sql.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          session_token_hash TEXT NOT NULL,
          batch_id TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          maximum_uploads INTEGER NOT NULL,
          used_uploads INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS claims (
          request_id TEXT PRIMARY KEY,
          public_id TEXT NOT NULL UNIQUE,
          sequence INTEGER NOT NULL CHECK (sequence >= 1)
        )
      `);
    }

    async fetch(request) {
      const url = new URL(request.url);
      if (request.method !== 'POST') return new Response(null, { status: 404 });

      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(null, { status: 400 });
      }
      if (!isRecord(body)) return new Response(null, { status: 400 });

      if (url.pathname === '/initialize') return this.initialize(body);
      if (url.pathname === '/claim') return this.claim(body);
      return new Response(null, { status: 404 });
    }

    initialize(body) {
      const allowed = new Set(['batchId', 'expiresAt', 'maxUploads', 'sessionTokenHash']);
      if (
        !hasOnlyKeys(body, allowed) ||
        typeof body.batchId !== 'string' || body.batchId.length < 12 || body.batchId.length > 64 ||
        typeof body.sessionTokenHash !== 'string' || !/^[a-f0-9]{64}$/.test(body.sessionTokenHash) ||
        !Number.isInteger(body.expiresAt) ||
        body.expiresAt <= Date.now() ||
        body.maxUploads !== MAX_UPLOADS_PER_SESSION
      ) {
        return new Response(null, { status: 400 });
      }

      const existing = this.sql.exec('SELECT id FROM sessions WHERE id = 1').toArray();
      if (existing.length) return new Response(null, { status: 409 });

      this.sql.exec(
        `INSERT INTO sessions (id, session_token_hash, batch_id, expires_at, maximum_uploads, used_uploads)
         VALUES (1, ?, ?, ?, ?, 0)`,
        body.sessionTokenHash,
        body.batchId,
        body.expiresAt,
        body.maxUploads
      );
      return Response.json({ ok: true }, { status: 201 });
    }

    claim(body) {
      const allowed = new Set(['now', 'requestId', 'sessionTokenHash']);
      if (
        !hasOnlyKeys(body, allowed) ||
        typeof body.sessionTokenHash !== 'string' || !/^[a-f0-9]{64}$/.test(body.sessionTokenHash) ||
        typeof body.requestId !== 'string' || !REQUEST_ID_PATTERN.test(body.requestId) ||
        !Number.isInteger(body.now)
      ) {
        return new Response(null, { status: 400 });
      }

      // Storage work in one synchronous DO turn cannot interleave with another
      // claim. A retry resolves its saved claim before quota is evaluated.
      const session = this.sql.exec(
        `SELECT batch_id, expires_at, maximum_uploads, used_uploads, session_token_hash
         FROM sessions WHERE id = 1`
      ).toArray()[0];
      if (!session || session.expires_at <= body.now) return new Response(null, { status: 410 });
      if (session.session_token_hash !== body.sessionTokenHash) return new Response(null, { status: 403 });

      const existing = this.sql.exec(
        'SELECT public_id, sequence FROM claims WHERE request_id = ?',
        body.requestId
      ).toArray()[0];
      if (existing) {
        return Response.json({
          ok: true,
          batchId: session.batch_id,
          publicId: existing.public_id,
          reused: true,
          sequence: existing.sequence
        });
      }

      const update = this.sql.exec(
        `UPDATE sessions SET used_uploads = used_uploads + 1
         WHERE id = 1 AND used_uploads < maximum_uploads AND expires_at > ?`,
        body.now
      );
      if (update.rowsWritten !== 1) return new Response(null, { status: 429 });

      const sequence = session.used_uploads + 1;
      const publicId = randomPublicId(session.batch_id);
      this.sql.exec(
        'INSERT INTO claims (request_id, public_id, sequence) VALUES (?, ?, ?)',
        body.requestId,
        publicId,
        sequence
      );

      return Response.json({
        ok: true,
        batchId: session.batch_id,
        publicId,
        reused: false,
        sequence
      });
    }
  };
}
