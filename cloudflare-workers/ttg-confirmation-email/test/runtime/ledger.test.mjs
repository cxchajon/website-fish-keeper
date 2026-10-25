import { env, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const DAY_MS = 24 * 60 * 60 * 1000;
const hash = (character) => character.repeat(64);

function freshLedger() {
  return env.CONFIRM_LEDGER.get(env.CONFIRM_LEDGER.newUniqueId());
}

async function call(stub, path, body) {
  const response = await stub.fetch(`https://confirmation-ledger.internal${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: response.ok ? await response.json() : null };
}

const reserve = (stub, deliveryHash, recipientHash, dailyCap = 50) =>
  call(stub, '/reserve', { deliveryHash, recipientHash, dailyCap }).then((result) => result.body?.decision);

describe('ConfirmationLedger in the Cloudflare Workers runtime', () => {
  it('reserves once and reports a repeat of the same delivery as a duplicate', async () => {
    const stub = freshLedger();
    expect(await reserve(stub, hash('a'), hash('1'))).toBe('reserved');
    expect(await reserve(stub, hash('a'), hash('1'))).toBe('duplicate');
  });

  it('allows separate tanks for one recipient up to three a day', async () => {
    const stub = freshLedger();
    expect(await reserve(stub, hash('a'), hash('1'))).toBe('reserved');
    expect(await reserve(stub, hash('b'), hash('1'))).toBe('reserved');
    expect(await reserve(stub, hash('c'), hash('1'))).toBe('reserved');
    expect(await reserve(stub, hash('d'), hash('1'))).toBe('recipient_limit');
    expect(await reserve(stub, hash('e'), hash('2'))).toBe('reserved');
  });

  it('enforces the site-wide daily cap', async () => {
    const stub = freshLedger();
    expect(await reserve(stub, hash('a'), hash('1'), 2)).toBe('reserved');
    expect(await reserve(stub, hash('b'), hash('2'), 2)).toBe('reserved');
    expect(await reserve(stub, hash('c'), hash('3'), 2)).toBe('daily_limit');
  });

  it('decides concurrent requests for one delivery exactly once', async () => {
    const stub = freshLedger();
    const decisions = await Promise.all(Array.from({ length: 5 }, () => reserve(stub, hash('a'), hash('1'))));
    expect(decisions.filter((decision) => decision === 'reserved')).toHaveLength(1);
    expect(decisions.filter((decision) => decision === 'duplicate')).toHaveLength(4);
  });

  it('release frees a reservation so a retry can send', async () => {
    const stub = freshLedger();
    expect(await reserve(stub, hash('a'), hash('1'))).toBe('reserved');
    expect((await call(stub, '/release', { deliveryHash: hash('a') })).status).toBe(200);
    expect(await reserve(stub, hash('a'), hash('1'))).toBe('reserved');
  });

  it('stores only hashes and deletes them after 24 hours, by request or by alarm', async () => {
    const stub = freshLedger();
    expect(await reserve(stub, hash('a'), hash('1'))).toBe('reserved');
    await runInDurableObject(stub, async (instance, state) => {
      const columns = instance.sql.exec('PRAGMA table_info(deliveries)').toArray().map((row) => row.name);
      expect(columns).toEqual(['delivery_hash', 'recipient_hash', 'sent_at']);
      expect(await state.storage.getAlarm()).not.toBeNull();
      instance.sql.exec('UPDATE deliveries SET sent_at = ?', Date.now() - DAY_MS - 1);
    });
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await runInDurableObject(stub, async (instance, state) => {
      expect(instance.sql.exec('SELECT COUNT(*) AS total FROM deliveries').one().total).toBe(0);
      expect(await state.storage.getAlarm()).toBeNull();
    });
    expect(await reserve(stub, hash('a'), hash('1'))).toBe('reserved');
  });

  it('rejects malformed requests', async () => {
    const stub = freshLedger();
    expect((await call(stub, '/reserve', { deliveryHash: 'visitor@example.com', recipientHash: hash('1'), dailyCap: 50 })).status).toBe(400);
    expect((await call(stub, '/reserve', { deliveryHash: hash('a'), recipientHash: hash('1'), dailyCap: 0 })).status).toBe(400);
    expect((await call(stub, '/unknown', { deliveryHash: hash('a') })).status).toBe(400);
  });
});
