import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../worker.js';

const ORIGIN = 'https://thetankguide.com';
const VALID_TURNSTILE = {
  success: true,
  hostname: 'thetankguide.com',
  action: 'ttg_confirmation'
};

function request(body = {}, options = {}) {
  return new Request('https://ttg-confirmation-email.fishkeepinglifeco.workers.dev/confirm', {
    method: options.method || 'POST',
    headers: {
      Origin: options.origin || ORIGIN,
      'CF-Connecting-IP': '203.0.113.10',
      'Content-Type': options.contentType || 'application/json'
    },
    body: options.rawBody ?? JSON.stringify({
      email: 'visitor@example.com',
      name: 'Test Visitor',
      tankName: 'Test Tank',
      turnstileToken: 'test-turnstile-token',
      ...body
    })
  });
}

function env() {
  return {
    TURNSTILE_SECRET_KEY: 'test-secret',
    RESEND_API_KEY: 'test-resend-key',
    CONFIRM_RATE_LIMITER: { limit: async () => ({ success: true }) }
  };
}

async function withFetchMock(handler, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function runVerification(verification, requestOptions = {}) {
  const calls = [];
  const response = await withFetchMock(async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('/siteverify')) {
      return new Response(JSON.stringify(verification), {
        status: requestOptions.siteverifyStatus || 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (String(url) === 'https://api.resend.com/emails') {
      return new Response(JSON.stringify({ id: 'email-test-id' }), { status: 200 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }, () => worker.fetch(request(requestOptions.body, requestOptions), env()));
  return { response, calls };
}

function resendCalls(calls) {
  return calls.filter(({ url }) => url === 'https://api.resend.com/emails');
}

test('sends exactly one email after a valid confirmation token', async () => {
  const { response, calls } = await runVerification(VALID_TURNSTILE);
  assert.equal(response.status, 200);
  assert.equal(resendCalls(calls).length, 1);
});

test('missing token is rejected before Siteverify and Resend', async () => {
  const { response, calls } = await runVerification(VALID_TURNSTILE, { body: { turnstileToken: '' } });
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});

for (const [name, verification] of [
  ['invalid', { success: false, 'error-codes': ['invalid-input-response'] }],
  ['expired', { success: false, 'error-codes': ['timeout-or-duplicate'] }],
  ['reused', { success: false, 'error-codes': ['timeout-or-duplicate'] }],
  ['wrong hostname', { ...VALID_TURNSTILE, hostname: 'attacker.example' }],
  ['missing hostname', { success: true, action: 'ttg_confirmation' }],
  ['wrong action', { ...VALID_TURNSTILE, action: 'ttg_upload_authorize' }],
  ['missing action', { success: true, hostname: 'thetankguide.com' }]
]) {
  test(`${name} confirmation verification is rejected without Resend`, async () => {
    const { response, calls } = await runVerification(verification);
    assert.equal(response.status, 400);
    assert.equal(resendCalls(calls).length, 0);
  });
}

test('failed and malformed Siteverify responses are rejected without Resend', async () => {
  const failed = await runVerification(VALID_TURNSTILE, { siteverifyStatus: 500 });
  assert.equal(failed.response.status, 400);
  assert.equal(resendCalls(failed.calls).length, 0);

  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response('not json', { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const response = await worker.fetch(request(), env());
    assert.equal(response.status, 400);
    assert.equal(calls.filter((url) => url === 'https://api.resend.com/emails').length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
