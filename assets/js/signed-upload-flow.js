/**
 * Browser-side helpers for the opt-in signed Cloudinary Upload Widget flow.
 *
 * The browser receives only a short-lived session capability and a Cloudinary
 * API key/signature. It never receives the Cloudinary API secret and it sends
 * no file, filename, personal details, or upload parameters to the Worker.
 */

const PREPARE_REQUEST_KEYS = new Set(['requestId', 'sessionId', 'sessionToken', 'source', 'timestamp']);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function createRequestId() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return `ttg-upload-${base64Url(bytes)}`;
}

function isTrustedAuthorizerEndpoint(value) {
  if (typeof value !== 'string') return false;
  try {
    const endpoint = new URL(value);
    return endpoint.protocol === 'https:' &&
      Boolean(endpoint.hostname) &&
      !endpoint.username &&
      !endpoint.password &&
      !endpoint.search &&
      !endpoint.hash;
  } catch {
    return false;
  }
}

function isTurnstileSiteKey(value) {
  return typeof value === 'string' && /^0x[A-Za-z0-9_-]{20,}$/.test(value);
}

// The migration choice and its configuration validity are deliberately
// separate. A true flag selects signed mode even when configuration is bad,
// so a staging error can never silently re-enable unsigned uploads.
export function isSignedUploadEnabled(config) {
  return config?.signedUploadsEnabled === true;
}

export function isUnsignedUploadEnabled(config) {
  return config?.signedUploadsEnabled === false;
}

export function hasValidSignedUploadConfiguration(config) {
  return isSignedUploadEnabled(config) &&
    isTrustedAuthorizerEndpoint(config.uploadAuthorizerEndpoint) &&
    isTurnstileSiteKey(config.uploadTurnstileSiteKey) &&
    config.uploadTurnstileAction === 'ttg_upload_authorize' &&
    typeof config.cloudinaryCloudName === 'string' &&
    /^[a-z0-9_-]{1,64}$/i.test(config.cloudinaryCloudName);
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

class UploadFlowError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

function assertSession(value) {
  if (!isRecord(value) || !isRecord(value.session)) throw new Error('Upload authorization is unavailable.');
  const { id, token, expiresAt, maxUploads } = value.session;
  if (
    typeof id !== 'string' || id.length < 20 || id.length > 128 ||
    typeof token !== 'string' || token.length < 40 || token.length > 128 ||
    !Number.isInteger(expiresAt) || expiresAt <= Date.now() ||
    maxUploads !== 5
  ) {
    throw new Error('Upload authorization is unavailable.');
  }
  return { id, token, expiresAt, maxUploads };
}

function assertUploadParams(value, cloudName) {
  if (!isRecord(value) || value.ok !== true || value.cloudName !== cloudName || !isRecord(value.uploadParams)) {
    throw new Error('Secure upload preparation failed.');
  }

  const params = value.uploadParams;
  if (
    typeof params.apiKey !== 'string' ||
    typeof params.signature !== 'string' ||
    typeof params.publicId !== 'string' ||
    typeof params.uploadPreset !== 'string' ||
    !Number.isInteger(params.uploadSignatureTimestamp) ||
    params.resourceType !== 'image' ||
    params.overwrite !== false
  ) {
    throw new Error('Secure upload preparation failed.');
  }
  return params;
}

async function postJson(endpoint, body, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'omit',
      cache: 'no-store'
    });
  } catch {
    throw new UploadFlowError('Upload authorization is unavailable.');
  }
  const data = await readJson(response);
  if (!response.ok || !data?.ok) throw new UploadFlowError('Upload authorization is unavailable.', response.status);
  return data;
}

async function prepareWithOneSafeRetry(endpoint, body, fetchImpl) {
  try {
    return await postJson(endpoint, body, fetchImpl);
  } catch (error) {
    // A retry is only safe for a transient transport/server failure. It carries
    // the exact same request ID, so the Durable Object returns the first claim
    // if the original response was lost after a successful write.
    if (error instanceof UploadFlowError && (error.status === 0 || error.status >= 500)) {
      return postJson(endpoint, body, fetchImpl);
    }
    throw error;
  }
}

export async function authorizeUpload({ endpoint, turnstileToken, fetchImpl = fetch }) {
  if (!isTrustedAuthorizerEndpoint(endpoint) || typeof turnstileToken !== 'string' || !turnstileToken) {
    throw new Error('Upload authorization is unavailable.');
  }
  const data = await postJson(`${endpoint}/authorize`, { turnstileToken }, fetchImpl);
  return assertSession(data);
}

/**
 * Returns the exact callback function documented by Cloudinary's Upload Widget.
 * A WeakMap retains the same opaque request ID when the Widget retries the same
 * request object. The server turns it into one public ID and one quota claim.
 */
export function createPrepareUploadParamsHandler({
  endpoint,
  session,
  cloudName,
  fetchImpl = fetch,
  makeRequestId = createRequestId,
  onError = () => {}
}) {
  if (
    !isTrustedAuthorizerEndpoint(endpoint) ||
    !isRecord(session) || typeof cloudName !== 'string' || !cloudName
  ) {
    throw new Error('Secure upload setup is unavailable.');
  }

  const requestIds = new WeakMap();

  function idFor(widgetParams) {
    if (!isRecord(widgetParams)) throw new Error('Secure upload preparation failed.');
    let id = requestIds.get(widgetParams);
    if (!id) {
      id = makeRequestId();
      if (typeof id !== 'string' || id.length < 20 || id.length > 96) {
        throw new Error('Secure upload setup is unavailable.');
      }
      requestIds.set(widgetParams, id);
    }
    return id;
  }

  async function prepareOne(widgetParams) {
    const timestamp = widgetParams?.timestamp;
    if (!Number.isInteger(timestamp)) throw new Error('Secure upload preparation failed.');

    const request = {
      requestId: idFor(widgetParams),
      sessionId: session.id,
      sessionToken: session.token,
      source: 'uw',
      timestamp
    };
    if (!Object.keys(request).every((key) => PREPARE_REQUEST_KEYS.has(key))) {
      throw new Error('Secure upload preparation failed.');
    }

    const data = await prepareWithOneSafeRetry(`${endpoint}/prepare`, request, fetchImpl);
    return assertUploadParams(data, cloudName);
  }

  return async function prepareUploadParams(callback, widgetParams) {
    const many = Array.isArray(widgetParams);
    const requests = many ? widgetParams : [widgetParams];
    try {
      const prepared = await Promise.all(requests.map(prepareOne));
      callback(many ? prepared : prepared[0]);
    } catch (error) {
      // Never invoke the callback on a failed authorization: doing so could let
      // a Widget attempt an unsigned upload. The caller only receives a generic
      // message and can restart with a new Turnstile token/session.
      onError(error);
    }
  };
}
