import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  authorizeUpload,
  createPrepareUploadParamsHandler,
  hasValidSignedUploadConfiguration,
  isUnsignedUploadEnabled,
  isSignedUploadEnabled
} from '../../assets/js/signed-upload-flow.js';

const ENDPOINT = 'https://ttg-upload-authorizer.example';
const CLOUD_NAME = 'fishkeepinglifeco';

function session() {
  return {
    id: 'session-000000000000000000000001',
    token: 's'.repeat(43),
    expiresAt: Date.now() + 60_000,
    maxUploads: 5
  };
}

function signedResponse({ publicId = 'feature-batch-random', timestamp = 1_700_000_000 } = {}) {
  return {
    ok: true,
    cloudName: CLOUD_NAME,
    uploadParams: {
      apiKey: 'public-api-key',
      signature: 'a'.repeat(40),
      publicId,
      uploadPreset: 'feature-your-tank-signed-v1',
      resourceType: 'image',
      overwrite: false,
      uploadSignatureTimestamp: timestamp
    }
  };
}

test('only an explicit false flag selects unsigned uploads; true selects signed mode even with bad configuration', () => {
  assert.equal(isSignedUploadEnabled({ signedUploadsEnabled: false }), false);
  assert.equal(isUnsignedUploadEnabled({ signedUploadsEnabled: false }), true);
  assert.equal(isSignedUploadEnabled({}), false);
  assert.equal(isUnsignedUploadEnabled({}), false);
  assert.equal(isSignedUploadEnabled({
    signedUploadsEnabled: true,
    uploadAuthorizerEndpoint: ENDPOINT,
    uploadTurnstileSiteKey: ''
  }), true);
  assert.equal(hasValidSignedUploadConfiguration({
    signedUploadsEnabled: true,
    uploadAuthorizerEndpoint: ENDPOINT,
    uploadTurnstileSiteKey: ''
  }), false);
  assert.equal(hasValidSignedUploadConfiguration({
    signedUploadsEnabled: true,
    uploadAuthorizerEndpoint: 'http://ttg-upload-authorizer.example',
    uploadTurnstileSiteKey: '0x4AAAAA-test-site-key',
    uploadTurnstileAction: 'ttg_upload_authorize',
    cloudinaryCloudName: CLOUD_NAME
  }), false);
  assert.equal(isSignedUploadEnabled({
    signedUploadsEnabled: true,
    uploadAuthorizerEndpoint: ENDPOINT,
    uploadTurnstileSiteKey: '0x4AAAAA-test-site-key'
  }), true);
  assert.equal(hasValidSignedUploadConfiguration({
    signedUploadsEnabled: true,
    uploadAuthorizerEndpoint: ENDPOINT,
    uploadTurnstileSiteKey: '0x4AAAAA-test-site-key',
    uploadTurnstileAction: 'ttg_upload_authorize',
    cloudinaryCloudName: CLOUD_NAME
  }), true);
});

test('authorization sends only the dedicated Turnstile token and returns a bounded session', async () => {
  const requests = [];
  const issuedSession = session();
  const result = await authorizeUpload({
    endpoint: ENDPOINT,
    turnstileToken: 'dedicated-upload-turnstile-token',
    fetchImpl: async (url, init) => {
      requests.push({ url, body: JSON.parse(init.body), init });
      return Response.json({ ok: true, session: issuedSession }, { status: 201 });
    }
  });

  assert.deepEqual(result, issuedSession);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, `${ENDPOINT}/authorize`);
  assert.deepEqual(requests[0].body, { turnstileToken: 'dedicated-upload-turnstile-token' });
  assert.equal(requests[0].init.credentials, 'omit');
});

test('authorization fails closed for invalid endpoints and expired or malformed Worker sessions', async () => {
  let calls = 0;
  await assert.rejects(authorizeUpload({
    endpoint: 'http://ttg-upload-authorizer.example',
    turnstileToken: 'dedicated-upload-turnstile-token',
    fetchImpl: async () => {
      calls += 1;
      return Response.json({ ok: true });
    }
  }));
  assert.equal(calls, 0);

  await assert.rejects(authorizeUpload({
    endpoint: ENDPOINT,
    turnstileToken: 'dedicated-upload-turnstile-token',
    fetchImpl: async () => Response.json({
      ok: true,
      session: { ...session(), expiresAt: Date.now() - 1 }
    })
  }));

  await assert.rejects(authorizeUpload({
    endpoint: ENDPOINT,
    turnstileToken: 'dedicated-upload-turnstile-token',
    fetchImpl: async () => Response.json({ ok: true })
  }));

  await assert.rejects(authorizeUpload({
    endpoint: ENDPOINT,
    turnstileToken: 'dedicated-upload-turnstile-token',
    fetchImpl: async () => Response.json({ ok: true, session: { id: 'malformed' } })
  }));
});

test('Upload Widget retry of the same request object reuses its opaque request ID', async () => {
  const requests = [];
  const delivered = [];
  const handler = createPrepareUploadParamsHandler({
    endpoint: ENDPOINT,
    session: session(),
    cloudName: CLOUD_NAME,
    makeRequestId: () => 'ttg-upload-request-id-000001',
    fetchImpl: async (url, init) => {
      requests.push({ url, body: JSON.parse(init.body) });
      return Response.json(signedResponse({ timestamp: JSON.parse(init.body).timestamp }));
    }
  });
  const widgetRequest = { timestamp: 1_700_000_000 };

  await handler((params) => delivered.push(params), widgetRequest);
  await handler((params) => delivered.push(params), widgetRequest);

  assert.equal(delivered.length, 2);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, `${ENDPOINT}/prepare`);
  assert.equal(requests[0].body.requestId, requests[1].body.requestId);
  assert.deepEqual(Object.keys(requests[0].body).sort(), [
    'requestId', 'sessionId', 'sessionToken', 'source', 'timestamp'
  ]);
  assert.equal(requests[0].body.source, 'uw');
  assert.equal('file' in requests[0].body, false);
  assert.equal('publicId' in requests[0].body, false);
  assert.equal(delivered[0].signature, 'a'.repeat(40));
});

test('retries one transient prepare failure with the identical request ID', async () => {
  const requests = [];
  const handler = createPrepareUploadParamsHandler({
    endpoint: ENDPOINT,
    session: session(),
    cloudName: CLOUD_NAME,
    makeRequestId: () => 'ttg-upload-request-id-000004',
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body);
      requests.push(body);
      if (requests.length === 1) throw new TypeError('simulated lost response');
      return Response.json(signedResponse({ timestamp: body.timestamp }));
    }
  });
  let delivered;

  await handler((params) => {
    delivered = params;
  }, { timestamp: 1_700_000_000 });

  assert.equal(requests.length, 2);
  assert.equal(requests[0].requestId, requests[1].requestId);
  assert.equal(delivered.publicId, 'feature-batch-random');
});

test('does not call the Widget callback after a rejected prepare response', async () => {
  let callbackCalled = false;
  const errors = [];
  const handler = createPrepareUploadParamsHandler({
    endpoint: ENDPOINT,
    session: session(),
    cloudName: CLOUD_NAME,
    makeRequestId: () => 'ttg-upload-request-id-000002',
    fetchImpl: async () => Response.json({ ok: false }, { status: 429 }),
    onError: (error) => errors.push(error)
  });

  await handler(() => {
    callbackCalled = true;
  }, { timestamp: 1_700_000_000 });

  assert.equal(callbackCalled, false);
  assert.equal(errors.length, 1);
});

test('does not call the Widget callback after a malformed signing response', async () => {
  let callbackCalled = false;
  const errors = [];
  const handler = createPrepareUploadParamsHandler({
    endpoint: ENDPOINT,
    session: session(),
    cloudName: CLOUD_NAME,
    makeRequestId: () => 'ttg-upload-request-id-000005',
    fetchImpl: async () => Response.json({ ok: true, cloudName: CLOUD_NAME, uploadParams: {} }),
    onError: (error) => errors.push(error)
  });

  await handler(() => {
    callbackCalled = true;
  }, { timestamp: 1_700_000_000 });

  assert.equal(callbackCalled, false);
  assert.equal(errors.length, 1);
});

test('fails closed before a network call when the Widget supplies an invalid timestamp', async () => {
  let calls = 0;
  const errors = [];
  const handler = createPrepareUploadParamsHandler({
    endpoint: ENDPOINT,
    session: session(),
    cloudName: CLOUD_NAME,
    makeRequestId: () => 'ttg-upload-request-id-000003',
    fetchImpl: async () => {
      calls += 1;
      return Response.json(signedResponse());
    },
    onError: (error) => errors.push(error)
  });

  await handler(() => assert.fail('the callback must not run'), { timestamp: 'not-an-integer' });
  assert.equal(calls, 0);
  assert.equal(errors.length, 1);
});

test('the production signed integration preserves the existing Formspree and confirmation-email workflows', async () => {
  const source = await readFile(new URL('../../assets/js/feature-your-tank.js', import.meta.url), 'utf8');
  const page = await readFile(new URL('../../submit-your-tank.html', import.meta.url), 'utf8');

  assert.match(source, /signedUploadsEnabled:\s*true/);
  assert.match(source, /uploadAuthorizerEndpoint:\s*'https:\/\/ttg-upload-authorizer\.fishkeepinglifeco\.workers\.dev'/);
  assert.match(source, /uploadTurnstileSiteKey:\s*'0x4AAAAAAFgIpX6-3TZ_PvKh'/);
  assert.match(source, /cloudinaryUploadPreset:\s*'feature-your-tank'/);
  assert.match(source, /formspreeEndpoint:\s*'https:\/\/formspree\.io\/f\/xangqlww'/);
  assert.match(source, /confirmationEndpoint:\s*'https:\/\/ttg-confirmation-email\.fishkeepinglifeco\.workers\.dev\/confirm'/);
  assert.match(source, /confirmationTurnstileSiteKey:\s*'0x4AAAAAAFYL1izh-TK-lIa9'/);
  assert.match(source, /confirmationTurnstileAction:\s*'ttg_confirmation'/);
  assert.match(source, /getFreshConfirmationTurnstileToken/);
  assert.match(source, /action:\s*CONFIG\.confirmationTurnstileAction/);
  assert.match(source, /appearance:\s*'interaction-only'/);
  assert.match(source, /confirmationEmailPromise/);
  assert.ok(source.indexOf('if (response.ok)') < source.indexOf('getFreshConfirmationTurnstileToken()'));
  assert.doesNotMatch(source, /window\.turnstile\.reset\(\)/);
  assert.match(source, /folder:\s*'feature-your-tank'/);
  assert.match(page, /id="uploadSecurityCheck"[^>]*hidden/);
  assert.match(page, /id="confirmationTurnstile"[^>]*hidden/);
  assert.match(page, /feature-your-tank\.js\?v=1\.0\.9" type="module"/);
  assert.doesNotMatch(page, /id="uploadTurnstile" class="cf-turnstile"/);
});
