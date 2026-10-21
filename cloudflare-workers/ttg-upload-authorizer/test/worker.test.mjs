import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  cloudinarySignature,
  handleRequest,
  randomPublicId,
  sha256Hex
} from '../worker-core.js';

const ORIGIN = 'https://thetankguide.com';
const PRODUCTION_ORIGINS = 'https://thetankguide.com,https://www.thetankguide.com';
const PRODUCTION_HOSTNAMES = 'thetankguide.com,www.thetankguide.com';

class FakeRateLimiter {
  constructor(limit = 100) {
    this.maximum = limit;
    this.calls = new Map();
  }

  async limitRequest({ key }) {
    const count = (this.calls.get(key) || 0) + 1;
    this.calls.set(key, count);
    return { success: count <= this.maximum };
  }

  async limit({ key }) {
    return this.limitRequest({ key });
  }
}

class FakeUploadSession {
  constructor() {
    this.session = null;
    this.claims = new Map();
  }

  async fetch(url, init) {
    const path = new URL(url).pathname;
    const body = JSON.parse(init.body);

    if (path === '/initialize') {
      if (this.session) return Response.json({ ok: false }, { status: 409 });
      this.session = { ...body, usedUploads: 0 };
      this.claims.clear();
      return Response.json({ ok: true }, { status: 201 });
    }

    if (path === '/claim') {
      if (!this.session) return Response.json({ ok: false }, { status: 404 });
      if (this.session.expiresAt <= body.now) return Response.json({ ok: false }, { status: 410 });
      if (this.session.sessionTokenHash !== body.sessionTokenHash) return Response.json({ ok: false }, { status: 403 });

      const existing = this.claims.get(body.requestId);
      if (existing) {
        return Response.json({
          ok: true,
          batchId: this.session.batchId,
          publicId: existing.publicId,
          reused: true,
          sequence: existing.sequence
        });
      }

      if (this.session.usedUploads >= this.session.maxUploads) return Response.json({ ok: false }, { status: 429 });

      this.session.usedUploads += 1;
      const claim = {
        publicId: `feature-${this.session.batchId}-mock-${this.session.usedUploads}`,
        sequence: this.session.usedUploads
      };
      this.claims.set(body.requestId, claim);
      return Response.json({
        ok: true,
        batchId: this.session.batchId,
        publicId: claim.publicId,
        reused: false,
        sequence: claim.sequence
      });
    }

    return Response.json({ ok: false }, { status: 404 });
  }
}

class FakeSessionsNamespace {
  constructor() {
    this.sequence = 0;
    this.sessions = new Map();
  }

  newUniqueId() {
    this.sequence += 1;
    return `session-${String(this.sequence).padStart(24, '0')}`;
  }

  idFromString(id) {
    if (typeof id !== 'string' || !/^session-\d{24}$/.test(id)) throw new Error('invalid object id');
    return id;
  }

  get(id) {
    const key = String(id);
    if (!this.sessions.has(key)) this.sessions.set(key, new FakeUploadSession());
    return this.sessions.get(key);
  }
}

function turnstileFetchFactory({ hostname = 'thetankguide.com' } = {}) {
  const usedTokens = new Set();
  return async (_url, init) => {
    const fields = new URLSearchParams(init.body);
    const token = fields.get('response');
    const result = {
      success: true,
      hostname,
      action: 'ttg_upload_authorize'
    };

    if (!token || token === 'invalid') result.success = false;
    if (token === 'wrong-hostname') result.hostname = 'attacker.example';
    if (token === 'wrong-action') result.action = 'different-action';
    if (usedTokens.has(token)) result.success = false;
    usedTokens.add(token);
    return Response.json(result);
  };
}

function makeEnv({
  authLimit = 100,
  signLimit = 100,
  secrets = true,
  origins = PRODUCTION_ORIGINS,
  hostnames = PRODUCTION_HOSTNAMES
} = {}) {
  const auth = new FakeRateLimiter(authLimit);
  const sign = new FakeRateLimiter(signLimit);
  return {
    CLOUDINARY_API_KEY: secrets ? 'test-api-key' : '',
    CLOUDINARY_API_SECRET: secrets ? 'test-api-secret' : '',
    TURNSTILE_SECRET_KEY: secrets ? 'test-turnstile-secret' : '',
    ALLOWED_ORIGINS: origins,
    ALLOWED_HOSTNAMES: hostnames,
    UPLOAD_SESSIONS: new FakeSessionsNamespace(),
    UPLOAD_AUTH_RATE_LIMITER: auth,
    UPLOAD_SIGN_RATE_LIMITER: sign,
    __rate: { auth, sign }
  };
}

function request(path, body, { method = 'POST', origin = ORIGIN, headers = {} } = {}) {
  const finalHeaders = new Headers({ Origin: origin, ...headers });
  let serialized;
  if (body !== undefined) {
    serialized = typeof body === 'string' ? body : JSON.stringify(body);
    if (!finalHeaders.has('Content-Type')) finalHeaders.set('Content-Type', 'application/json');
  }
  return new Request(`https://upload-authorizer.example${path}`, {
    method,
    headers: finalHeaders,
    body: serialized
  });
}

function runtime(now = Date.now()) {
  return { fetchImpl: turnstileFetchFactory(), nowMs: () => now };
}

async function issueSession(env, runtimeOptions, token = 'valid-token') {
  const response = await handleRequest(request('/authorize', { turnstileToken: token }), env, runtimeOptions);
  assert.equal(response.status, 201);
  return response.json();
}

let requestSequence = 0;

function requestId() {
  requestSequence += 1;
  return `ttg-upload-request-${String(requestSequence).padStart(16, '0')}`;
}

function prepareBody(session, timestamp, changes = {}) {
  return {
    requestId: requestId(),
    sessionId: session.id,
    sessionToken: session.token,
    source: 'uw',
    timestamp,
    ...changes
  };
}

test('creates a valid short-lived authorization session after verified Turnstile', async () => {
  const now = Date.now();
  const env = makeEnv();
  const response = await handleRequest(request('/authorize', { turnstileToken: 'valid-token' }), env, runtime(now));
  const data = await response.json();

  assert.equal(response.status, 201);
  assert.equal(data.ok, true);
  assert.match(data.session.id, /^session-\d{24}$/);
  assert.equal(data.session.maxUploads, 5);
  assert.equal(data.session.expiresAt, now + 600_000);
  assert.match(data.session.token, /^[A-Za-z0-9_-]{43}$/);
});

test('rejects invalid, missing, reused, wrong-hostname, and wrong-action Turnstile tokens', async (t) => {
  for (const token of ['invalid', '', 'wrong-hostname', 'wrong-action']) {
    await t.test(token || 'missing', async () => {
      const response = await handleRequest(request('/authorize', { turnstileToken: token }), makeEnv(), runtime());
      assert.equal(response.status, 400);
    });
  }

  const env = makeEnv();
  const options = runtime();
  assert.equal((await handleRequest(request('/authorize', { turnstileToken: 'single-use' }), env, options)).status, 201);
  assert.equal((await handleRequest(request('/authorize', { turnstileToken: 'single-use' }), env, options)).status, 400);
});

test('rejects untrusted origins and only grants CORS to production origins', async () => {
  const rejected = await handleRequest(
    request('/authorize', { turnstileToken: 'valid-token' }, { origin: 'https://attacker.example' }),
    makeEnv(),
    runtime()
  );
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get('access-control-allow-origin'), null);

  const preflight = await handleRequest(request('/authorize', undefined, { method: 'OPTIONS' }), makeEnv(), runtime());
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), ORIGIN);
});

test('uses an isolated staging hostname policy and never falls back to production', async () => {
  const origin = 'https://staging.thetankguide.com';
  const env = makeEnv({ origins: origin, hostnames: 'staging.thetankguide.com' });
  const response = await handleRequest(
    request('/authorize', { turnstileToken: 'staging-token' }, { origin }),
    env,
    { fetchImpl: turnstileFetchFactory({ hostname: 'staging.thetankguide.com' }), nowMs: () => Date.now() }
  );
  assert.equal(response.status, 201);

  const productionTokenAtStaging = await handleRequest(
    request('/authorize', { turnstileToken: 'production-token-at-staging' }, { origin }),
    env,
    runtime()
  );
  assert.equal(productionTokenAtStaging.status, 400);

  const productionOrigin = await handleRequest(
    request('/authorize', { turnstileToken: 'production-token' }),
    env,
    runtime()
  );
  assert.equal(productionOrigin.status, 403);

  delete env.ALLOWED_HOSTNAMES;
  const missingPolicy = await handleRequest(request('/authorize', { turnstileToken: 'missing-policy' }), env, runtime());
  assert.equal(missingPolicy.status, 503);
});

test('fails closed when secrets or rate-limit bindings are missing', async () => {
  const missingSecrets = await handleRequest(request('/authorize', { turnstileToken: 'valid-token' }), makeEnv({ secrets: false }), runtime());
  assert.equal(missingSecrets.status, 503);

  const env = makeEnv();
  delete env.UPLOAD_AUTH_RATE_LIMITER;
  const missingRateLimit = await handleRequest(request('/authorize', { turnstileToken: 'valid-token' }), env, runtime());
  assert.equal(missingRateLimit.status, 503);
});

test('enforces per-IP authorization rate limiting', async () => {
  const env = makeEnv({ authLimit: 1 });
  const options = runtime();
  assert.equal((await handleRequest(request('/authorize', { turnstileToken: 'one' }), env, options)).status, 201);
  assert.equal((await handleRequest(request('/authorize', { turnstileToken: 'two' }), env, options)).status, 429);
});

test('prepares a callback-ready Upload Widget signed-upload response with server-owned parameters', async () => {
  const now = Date.now();
  const env = makeEnv();
  const options = runtime(now);
  const authorized = await issueSession(env, options);
  const response = await handleRequest(
    request('/prepare', prepareBody(authorized.session, Math.floor(now / 1_000))),
    env,
    options
  );
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.cloudName, 'fishkeepinglifeco');
  assert.equal(data.uploadParams.apiKey, 'test-api-key');
  assert.equal(data.uploadParams.uploadPreset, 'feature-your-tank-signed-v1');
  assert.equal(data.uploadParams.overwrite, false);
  assert.equal(data.uploadParams.resourceType, 'image');
  assert.equal(data.uploadParams.uploadSignatureTimestamp, Math.floor(now / 1_000));
  assert.match(data.uploadParams.publicId, /^feature-[A-Za-z0-9_-]+-[A-Za-z0-9_-]+$/);
  assert.ok(data.uploadParams.tags.includes('ttg-pending'));
  assert.match(data.uploadParams.signature, /^[a-f0-9]{40}$/);
  assert.equal('folder' in data.uploadParams, false);
  assert.equal('assetFolder' in data.uploadParams, false);
  assert.equal('publicIdPrefix' in data.uploadParams, false);
});

test('signs the exact Dynamic Folder preset request that the Upload Widget will send', async () => {
  const now = Date.now();
  const env = makeEnv();
  const options = runtime(now);
  const authorized = await issueSession(env, options);
  const timestamp = Math.floor(now / 1_000);
  const response = await handleRequest(
    request('/prepare', prepareBody(authorized.session, timestamp)),
    env,
    options
  );
  const { uploadParams } = await response.json();

  // The Dashboard's signed preset owns asset_folder and
  // use_asset_folder_as_public_id_prefix. Neither is part of this browser
  // request, while source=uw must be signed even though the Widget adds it.
  const signature = await cloudinarySignature({
    context: uploadParams.context,
    overwrite: 'false',
    public_id: uploadParams.publicId,
    source: 'uw',
    tags: uploadParams.tags,
    timestamp: String(uploadParams.uploadSignatureTimestamp),
    upload_preset: uploadParams.uploadPreset,
    api_key: uploadParams.apiKey,
    cloud_name: 'excluded',
    resource_type: 'image'
  }, 'test-api-secret');

  assert.equal(signature, uploadParams.signature);
});

test('rejects expired sessions and timestamps outside the widget freshness window', async () => {
  const now = Date.now();
  const env = makeEnv();
  const options = runtime(now);
  const authorized = await issueSession(env, options);

  const expiredTimestamp = await handleRequest(
    request('/prepare', prepareBody(authorized.session, Math.floor(now / 1_000) - 121)),
    env,
    options
  );
  assert.equal(expiredTimestamp.status, 400);

  const stub = env.UPLOAD_SESSIONS.get(authorized.session.id);
  stub.session.expiresAt = now - 1;
  const expiredSession = await handleRequest(
    request('/prepare', prepareBody(authorized.session, Math.floor(now / 1_000))),
    env,
    options
  );
  assert.equal(expiredSession.status, 400);
});

test('enforces five atomic upload slots even under concurrent prepare requests', async () => {
  const now = Date.now();
  const env = makeEnv();
  const options = runtime(now);
  const authorized = await issueSession(env, options);
  const timestamp = Math.floor(now / 1_000);

  const responses = await Promise.all(
    Array.from({ length: 6 }, () => handleRequest(
      request('/prepare', prepareBody(authorized.session, timestamp)),
      env,
      options
    ))
  );
  const statuses = responses.map((item) => item.status).sort();
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);
});

test('rejects bad session capabilities and Cloudinary parameter injection attempts', async () => {
  const now = Date.now();
  const env = makeEnv();
  const options = runtime(now);
  const authorized = await issueSession(env, options);
  const timestamp = Math.floor(now / 1_000);

  const wrongToken = await handleRequest(
    request('/prepare', prepareBody(authorized.session, timestamp, { sessionToken: 'x'.repeat(43) })),
    env,
    options
  );
  assert.equal(wrongToken.status, 400);

  const invalidRequestId = await handleRequest(
    request('/prepare', prepareBody(authorized.session, timestamp, { requestId: 'not-a-valid-id' })),
    env,
    options
  );
  assert.equal(invalidRequestId.status, 400);

  for (const attempted of [
    { publicId: 'attacker-id' },
    { folder: 'other-folder' },
    { overwrite: true },
    { transformation: 'e_blur:1000' },
    { tags: ['attacker-tag'] }
  ]) {
    const response = await handleRequest(
      request('/prepare', prepareBody(authorized.session, timestamp, attempted)),
      env,
      options
    );
    assert.equal(response.status, 400);
  }
});

test('returns the same capability for an idempotent signing retry without consuming another slot', async () => {
  const now = Date.now();
  const env = makeEnv();
  const options = runtime(now);
  const authorized = await issueSession(env, options);
  const timestamp = Math.floor(now / 1_000);
  const retryId = requestId();
  const first = await handleRequest(
    request('/prepare', prepareBody(authorized.session, timestamp, { requestId: retryId })),
    env,
    options
  );
  const retry = await handleRequest(
    request('/prepare', prepareBody(authorized.session, timestamp, { requestId: retryId })),
    env,
    options
  );
  const [firstData, retryData] = await Promise.all([first.json(), retry.json()]);
  assert.equal(first.status, 200);
  assert.equal(retry.status, 200);
  assert.equal(firstData.uploadParams.publicId, retryData.uploadParams.publicId);
  assert.equal(env.UPLOAD_SESSIONS.get(authorized.session.id).session.usedUploads, 1);

  const uniqueResponses = await Promise.all(Array.from({ length: 4 }, () => handleRequest(
    request('/prepare', prepareBody(authorized.session, timestamp)),
    env,
    options
  )));
  assert.deepEqual(uniqueResponses.map((item) => item.status), [200, 200, 200, 200]);

  const sixth = await handleRequest(request('/prepare', prepareBody(authorized.session, timestamp)), env, options);
  assert.equal(sixth.status, 429);

  const retryAfterQuota = await handleRequest(
    request('/prepare', prepareBody(authorized.session, timestamp, { requestId: retryId })),
    env,
    options
  );
  assert.equal(retryAfterQuota.status, 200);
});

test('rejects malformed JSON, oversized request bodies, unsupported methods, and unknown paths', async () => {
  const malformed = await handleRequest(request('/authorize', '{'), makeEnv(), runtime());
  assert.equal(malformed.status, 400);

  const oversized = await handleRequest(request('/authorize', 'x'.repeat(4_097)), makeEnv(), runtime());
  assert.equal(oversized.status, 400);

  const unsupported = await handleRequest(request('/authorize', undefined, { method: 'GET' }), makeEnv(), runtime());
  assert.equal(unsupported.status, 405);

  const unknown = await handleRequest(request('/unexpected', { turnstileToken: 'valid-token' }), makeEnv(), runtime());
  assert.equal(unknown.status, 404);
});

test('creates non-personal unpredictable public IDs and hashes session tokens before storage', async () => {
  const first = randomPublicId('batch-test');
  const second = randomPublicId('batch-test');
  assert.match(first, /^feature-batch-test-[A-Za-z0-9_-]{24}$/);
  assert.notEqual(first, second);
  assert.equal(await sha256Hex('session-token'), 'c101e911469c969171040b50d70543313cf968fdef5bacc780776f8fb399ab36');
});

test('declares unique rate-limit namespaces and an SQLite-backed Durable Object export', async () => {
  const configPath = new URL('../wrangler.jsonc', import.meta.url);
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const rateLimits = new Map(config.ratelimits.map((binding) => [binding.name, binding]));
  const stagingRateLimits = new Map(config.env.staging.ratelimits.map((binding) => [binding.name, binding]));

  assert.deepEqual(rateLimits.get('UPLOAD_AUTH_RATE_LIMITER').simple, { limit: 3, period: 60 });
  assert.deepEqual(rateLimits.get('UPLOAD_SIGN_RATE_LIMITER').simple, { limit: 15, period: 60 });
  assert.notEqual(
    rateLimits.get('UPLOAD_AUTH_RATE_LIMITER').namespace_id,
    rateLimits.get('UPLOAD_SIGN_RATE_LIMITER').namespace_id
  );
  assert.equal(config.vars.ALLOWED_ORIGINS, PRODUCTION_ORIGINS);
  assert.equal(config.vars.ALLOWED_HOSTNAMES, PRODUCTION_HOSTNAMES);
  assert.equal(config.env.staging.vars.ALLOWED_ORIGINS, 'https://staging.thetankguide.com');
  assert.equal(config.env.staging.vars.ALLOWED_HOSTNAMES, 'staging.thetankguide.com');
  assert.deepEqual(config.env.staging.durable_objects.bindings, [{
    name: 'UPLOAD_SESSIONS',
    class_name: 'UploadSession'
  }]);
  assert.notEqual(
    stagingRateLimits.get('UPLOAD_AUTH_RATE_LIMITER').namespace_id,
    stagingRateLimits.get('UPLOAD_SIGN_RATE_LIMITER').namespace_id
  );
  assert.notEqual(
    stagingRateLimits.get('UPLOAD_AUTH_RATE_LIMITER').namespace_id,
    rateLimits.get('UPLOAD_AUTH_RATE_LIMITER').namespace_id
  );
  assert.deepEqual(config.exports.UploadSession, { type: 'durable-object', storage: 'sqlite' });

  const entrypoint = await readFile(new URL('../worker.js', import.meta.url), 'utf8');
  assert.match(entrypoint, /import \{ DurableObject \} from 'cloudflare:workers';/);
  assert.match(entrypoint, /createUploadSessionClass\(DurableObject\)/);
});
