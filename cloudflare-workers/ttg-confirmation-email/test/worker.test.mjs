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

// Stands in for the ConfirmationLedger Durable Object (its own behaviour is covered by
// test/runtime/ledger.test.mjs); records each call and answers /reserve with `decision`.
function fakeLedger(decision = 'reserved', options = {}) {
  const calls = [];
  return {
    calls,
    idFromName: (name) => name,
    get: () => ({
      fetch: async (url, init) => {
        const path = new URL(url).pathname;
        calls.push({ path, body: JSON.parse(init.body) });
        if (options.fail) return new Response(null, { status: 500 });
        return Response.json(path === '/reserve' ? { decision } : { released: true });
      }
    })
  };
}

function env(overrides = {}) {
  return {
    TURNSTILE_SECRET_KEY: 'test-secret',
    RESEND_API_KEY: 'test-resend-key',
    CONFIRM_DEDUP_KEY: 'k'.repeat(64),
    CONFIRM_LEDGER: fakeLedger(),
    CONFIRM_RATE_LIMITER: { limit: async () => ({ success: true }) },
    ...overrides
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

async function runVerification(verification, requestOptions = {}, workerEnv = env()) {
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
      if (requestOptions.resendNetworkError) throw new TypeError('network error');
      return new Response(JSON.stringify({ id: 'email-test-id' }), { status: requestOptions.resendStatus || 200 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  }, () => worker.fetch(request(requestOptions.body, requestOptions), workerEnv));
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

function sentEmail(calls) {
  const [call] = resendCalls(calls);
  return { headers: call.init.headers, payload: JSON.parse(call.init.body) };
}

async function confirmWith(body) {
  const { response, calls } = await runVerification(VALID_TURNSTILE, { body });
  assert.equal(response.status, 200);
  return sentEmail(calls).payload;
}

test('legitimate confirmation keeps sender, reply-to and the visitor name and tank', async () => {
  const payload = await confirmWith({ name: "Zoë O'Brien", tankName: 'Riverbank 40 Breeder (Fluval 13.5)' });
  assert.equal(payload.from, 'The Tank Guide <features@thetankguide.com>');
  assert.equal(payload.reply_to, 'fishkeepinglifeco@thetankguide.com');
  assert.deepEqual(payload.to, ['visitor@example.com']);
  assert.match(payload.html, /Hi Zoë O&#039;Brien,/);
  assert.match(payload.html, /Riverbank 40 Breeder \(Fluval 13\.5\)/);
  assert.match(payload.text, /Tank: Riverbank 40 Breeder \(Fluval 13\.5\)/);
  assert.match(payload.text, /you can ignore this email/);
});

for (const [label, field, value, leaked] of [
  ['URL in name', 'name', 'Visit https://evil.example/login', /evil|https/],
  ['bare domain in tank name', 'tankName', 'see evil-site.com now', /evil/],
  ['www link in name', 'name', 'www example', /www/],
  ['email address in tank name', 'tankName', 'reply to attacker@evil.example', /attacker|evil/],
  ['phone number in name', 'name', 'Call 1 (800) 555-0199', /555/],
  ['phishing instruction in tank name', 'tankName', 'Verify your account today', /Verify/i],
  ['HTML in name', 'name', '<a href="https://evil.example">Bob</a>', /evil|href|<a/],
  ['overlong tank name', 'tankName', 'A'.repeat(81), /AAAAAAAAAA/],
  ['bidirectional override in name', 'name', 'Bob‮moc.live', /live|moc/],
  ['full-width domain in tank name', 'tankName', 'ｅｖｉｌ．ｃｏｍ', /evil|ｅｖｉｌ/]
]) {
  test(`${label} is dropped from the email, which still sends with fixed wording`, async () => {
    const payload = await confirmWith({ [field]: value });
    assert.doesNotMatch(payload.html, leaked);
    assert.doesNotMatch(payload.text, leaked);
    if (field === 'name') assert.match(payload.html, /Hi there,/);
    else assert.doesNotMatch(payload.html, /Tank:/);
    assert.match(payload.html, /We received your Feature Your Tank submission/);
  });
}

test('the ledger receives keyed hashes only, and Resend gets the delivery hash as its idempotency key', async () => {
  const ledger = fakeLedger();
  const { calls } = await runVerification(VALID_TURNSTILE, {}, env({ CONFIRM_LEDGER: ledger, DAILY_DELIVERY_CAP: '20' }));
  assert.equal(ledger.calls.length, 1);
  const [{ path, body }] = ledger.calls;
  assert.equal(path, '/reserve');
  assert.match(body.recipientHash, /^[a-f0-9]{64}$/);
  assert.match(body.deliveryHash, /^[a-f0-9]{64}$/);
  assert.equal(body.dailyCap, 20);
  assert.doesNotMatch(JSON.stringify(body), /visitor|example|Test/);
  assert.equal(sentEmail(calls).headers['Idempotency-Key'], body.deliveryHash);
});

test('separate tanks for one visitor share a recipient hash but not a delivery hash', async () => {
  const ledger = fakeLedger();
  const workerEnv = env({ CONFIRM_LEDGER: ledger });
  await runVerification(VALID_TURNSTILE, { body: { tankName: 'Tank One' } }, workerEnv);
  await runVerification(VALID_TURNSTILE, { body: { email: 'VISITOR@example.com ', tankName: 'Tank Two' } }, workerEnv);
  const [first, second] = ledger.calls.map((call) => call.body);
  assert.equal(first.recipientHash, second.recipientHash);
  assert.notEqual(first.deliveryHash, second.deliveryHash);
});

test('an invalid daily cap setting falls back to the default', async () => {
  const ledger = fakeLedger();
  await runVerification(VALID_TURNSTILE, {}, env({ CONFIRM_LEDGER: ledger, DAILY_DELIVERY_CAP: 'lots' }));
  assert.equal(ledger.calls[0].body.dailyCap, 50);
});

test('a repeated request for the same tank is reported as sent without a second email', async () => {
  const { response, calls } = await runVerification(VALID_TURNSTILE, {}, env({ CONFIRM_LEDGER: fakeLedger('duplicate') }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(resendCalls(calls).length, 0);
});

for (const decision of ['recipient_limit', 'daily_limit']) {
  test(`${decision} withholds the email with a generic 429`, async () => {
    const { response, calls } = await runVerification(VALID_TURNSTILE, {}, env({ CONFIRM_LEDGER: fakeLedger(decision) }));
    assert.equal(response.status, 429);
    assert.deepEqual(await response.json(), { ok: false, error: 'Email could not be sent' });
    assert.equal(resendCalls(calls).length, 0);
  });
}

test('an unavailable ledger fails closed without Resend', async () => {
  const { response, calls } = await runVerification(VALID_TURNSTILE, {}, env({ CONFIRM_LEDGER: fakeLedger('reserved', { fail: true }) }));
  assert.equal(response.status, 503);
  assert.equal(resendCalls(calls).length, 0);
});

for (const [label, overrides] of [
  ['missing ledger binding', { CONFIRM_LEDGER: undefined }],
  ['missing dedup key', { CONFIRM_DEDUP_KEY: undefined }],
  ['short dedup key', { CONFIRM_DEDUP_KEY: 'short' }]
]) {
  test(`${label} fails closed before Turnstile and Resend`, async () => {
    const { response, calls } = await runVerification(VALID_TURNSTILE, {}, env(overrides));
    assert.equal(response.status, 503);
    assert.equal(calls.length, 0);
  });
}

test('a Resend error response returns 502 and releases the reservation for a retry', async () => {
  const ledger = fakeLedger();
  const { response } = await runVerification(VALID_TURNSTILE, { resendStatus: 500 }, env({ CONFIRM_LEDGER: ledger }));
  assert.equal(response.status, 502);
  assert.deepEqual(ledger.calls.map((call) => call.path), ['/reserve', '/release']);
  assert.equal(ledger.calls[1].body.deliveryHash, ledger.calls[0].body.deliveryHash);
});

test('a Resend network failure returns 502 but keeps the reservation, since the email may have been sent', async () => {
  const ledger = fakeLedger();
  const { response } = await runVerification(VALID_TURNSTILE, { resendNetworkError: true }, env({ CONFIRM_LEDGER: ledger }));
  assert.equal(response.status, 502);
  assert.deepEqual(ledger.calls.map((call) => call.path), ['/reserve']);
});

test('the per-IP rate limit still applies before any other work', async () => {
  const ledger = fakeLedger();
  const { response, calls } = await runVerification(VALID_TURNSTILE, {}, env({
    CONFIRM_LEDGER: ledger,
    CONFIRM_RATE_LIMITER: { limit: async () => ({ success: false }) }
  }));
  assert.equal(response.status, 429);
  assert.equal(calls.length, 0);
  assert.equal(ledger.calls.length, 0);
});

test('a filled honeypot is answered as sent without Turnstile, ledger or Resend', async () => {
  const ledger = fakeLedger();
  const { response, calls } = await runVerification(VALID_TURNSTILE, { body: { website: 'spam' } }, env({ CONFIRM_LEDGER: ledger }));
  assert.equal(response.status, 200);
  assert.equal(calls.length, 0);
  assert.equal(ledger.calls.length, 0);
});
