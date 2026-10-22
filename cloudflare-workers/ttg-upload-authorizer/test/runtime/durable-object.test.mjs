import { DurableObject, env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { UploadSession } from '../../worker.js';

const BASE_URL = 'https://upload-session.internal';
const TOKEN_HASH = 'a'.repeat(64);

async function request(stub, path, body) {
  return stub.fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function initializedStub() {
  const id = env.UPLOAD_SESSIONS.newUniqueId();
  const stub = env.UPLOAD_SESSIONS.get(id);
  const response = await request(stub, '/initialize', {
    batchId: 'runtime-batch-123456',
    expiresAt: Date.now() + 60_000,
    maxUploads: 5,
    sessionTokenHash: TOKEN_HASH
  });
  expect(response.status).toBe(201);
  return stub;
}

describe('UploadSession in the Cloudflare Workers runtime', () => {
  it('extends the Cloudflare DurableObject base class and uses a SQLite-backed binding', () => {
    expect(Object.getPrototypeOf(UploadSession.prototype)).toBe(DurableObject.prototype);
    expect(env.UPLOAD_SESSIONS).toBeDefined();
  });

  it('persists an idempotent claim in the actual Durable Object storage runtime', async () => {
    const stub = await initializedStub();
    const body = {
      now: Date.now(),
      requestId: 'runtime-retry-request-0001',
      sessionTokenHash: TOKEN_HASH
    };

    const first = await request(stub, '/claim', body);
    const retry = await request(stub, '/claim', body);
    const [firstData, retryData] = await Promise.all([first.json(), retry.json()]);

    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(firstData.reused).toBe(false);
    expect(retryData.reused).toBe(true);
    expect(retryData.publicId).toBe(firstData.publicId);
    expect(retryData.sequence).toBe(1);
  });

  it('allows exactly five unique concurrent claims while retaining retries after quota', async () => {
    const stub = await initializedStub();
    const now = Date.now();
    const claims = await Promise.all(Array.from({ length: 6 }, (_, index) => request(stub, '/claim', {
      now,
      requestId: `runtime-concurrent-request-${String(index).padStart(4, '0')}`,
      sessionTokenHash: TOKEN_HASH
    })));
    const statuses = claims.map((item) => item.status).sort();
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);

    const retry = await request(stub, '/claim', {
      now,
      requestId: 'runtime-concurrent-request-0000',
      sessionTokenHash: TOKEN_HASH
    });
    expect(retry.status).toBe(200);
    expect((await retry.json()).reused).toBe(true);
  });

  it('rejects expired sessions without returning a reusable capability', async () => {
    const id = env.UPLOAD_SESSIONS.newUniqueId();
    const stub = env.UPLOAD_SESSIONS.get(id);
    const expiresAt = Date.now() + 100;
    const initialized = await request(stub, '/initialize', {
      batchId: 'runtime-expiry-123456',
      expiresAt,
      maxUploads: 5,
      sessionTokenHash: TOKEN_HASH
    });
    expect(initialized.status).toBe(201);

    const expired = await request(stub, '/claim', {
      now: expiresAt + 1,
      requestId: 'runtime-expired-request-001',
      sessionTokenHash: TOKEN_HASH
    });
    expect(expired.status).toBe(410);
  });
});
