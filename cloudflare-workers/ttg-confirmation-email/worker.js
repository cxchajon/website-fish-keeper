const ALLOWED_ORIGINS = new Set([
  'https://thetankguide.com',
  'https://www.thetankguide.com'
]);
const ALLOWED_TURNSTILE_HOSTNAMES = new Set([
  'thetankguide.com',
  'www.thetankguide.com'
]);
const CONFIRMATION_TURNSTILE_ACTION = 'ttg_confirmation';

// Abuse limits. A valid Turnstile token proves a person solved a challenge on the site, not that the
// address belongs to them, so deliveries are also capped per recipient and site-wide. The ledger
// keeps only keyed hashes (never addresses or names) and forgets each one after 24 hours.
const LEDGER_WINDOW_MS = 24 * 60 * 60 * 1000;
const PER_RECIPIENT_DAILY_LIMIT = 3;
const DEFAULT_DAILY_DELIVERY_CAP = 50;
const NAME_MAX_LENGTH = 60;
const TANK_NAME_MAX_LENGTH = 80;

// Visitor-supplied text is echoed only if it reads like a name or tank name. Anything that could
// carry a link, an address, a phone number or an instruction is dropped and the email falls back to
// its fixed wording, so a third party cannot use the confirmation to deliver their own message.
const INVISIBLE_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g;
const ALLOWED_DISPLAY_TEXT = /^[\p{L}\p{M}\p{N} '\u2019.,&()#+-]+$/u;
const DOMAIN_LIKE = /[\p{L}\p{N}-]\.[\p{L}]{2,}/u;
const PHONE_LIKE = /(?:\d[\s().+-]*){7,}/;
const INSTRUCTION_WORDS = /\b(?:password|passcode|verify|verification|log\s?in|sign\s?in|account|click|call|text|whatsapp|telegram|bitcoin|crypto|wallet|gift\s?card|invoice|payment|refund|bank|wire|urgent|suspend\w*|security|support|http|www)\b/i;

function displayText(value, maxLength) {
  const text = String(value || '').normalize('NFKC').replace(INVISIBLE_CHARACTERS, '').replace(/\s+/g, ' ').trim();
  if (
    !text ||
    text.length > maxLength ||
    !ALLOWED_DISPLAY_TEXT.test(text) ||
    DOMAIN_LIKE.test(text) ||
    PHONE_LIKE.test(text) ||
    INSTRUCTION_WORDS.test(text)
  ) {
    return '';
  }
  return text;
}

async function keyedHash(key, label, value) {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey('raw', encoder.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(label + '\n' + value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function dailyDeliveryCap(env) {
  const configured = Number(env.DAILY_DELIVERY_CAP);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_DAILY_DELIVERY_CAP;
}

async function callLedger(env, path, body) {
  const stub = env.CONFIRM_LEDGER.get(env.CONFIRM_LEDGER.idFromName('global'));
  const response = await stub.fetch('https://confirmation-ledger.internal' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error('Ledger request failed: ' + response.status);
  return response.json();
}

/**
 * One global instance records recent deliveries as keyed hashes. Each request runs its reads and
 * writes in one synchronous turn, so two concurrent requests cannot both pass a limit.
 */
export class ConfirmationLedger {
  constructor(ctx) {
    this.ctx = ctx;
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS deliveries (
        delivery_hash TEXT PRIMARY KEY,
        recipient_hash TEXT NOT NULL,
        sent_at INTEGER NOT NULL
      )
    `);
  }

  async fetch(request) {
    if (request.method !== 'POST') return new Response(null, { status: 404 });
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(null, { status: 400 });
    }
    const isHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
    if (!body || !isHash(body.deliveryHash)) return new Response(null, { status: 400 });

    const path = new URL(request.url).pathname;
    if (path === '/release') {
      this.sql.exec('DELETE FROM deliveries WHERE delivery_hash = ?', body.deliveryHash);
      return Response.json({ released: true });
    }
    if (path !== '/reserve' || !isHash(body.recipientHash) || !Number.isInteger(body.dailyCap) || body.dailyCap < 1) {
      return new Response(null, { status: 400 });
    }

    const now = Date.now();
    this.sql.exec('DELETE FROM deliveries WHERE sent_at <= ?', now - LEDGER_WINDOW_MS);
    const count = (query, ...params) => this.sql.exec(query, ...params).one().total;

    let decision = 'reserved';
    if (count('SELECT COUNT(*) AS total FROM deliveries WHERE delivery_hash = ?', body.deliveryHash)) {
      decision = 'duplicate';
    } else if (count('SELECT COUNT(*) AS total FROM deliveries WHERE recipient_hash = ?', body.recipientHash) >= PER_RECIPIENT_DAILY_LIMIT) {
      decision = 'recipient_limit';
    } else if (count('SELECT COUNT(*) AS total FROM deliveries') >= body.dailyCap) {
      decision = 'daily_limit';
    } else {
      this.sql.exec(
        'INSERT INTO deliveries (delivery_hash, recipient_hash, sent_at) VALUES (?, ?, ?)',
        body.deliveryHash,
        body.recipientHash,
        now
      );
      if ((await this.ctx.storage.getAlarm()) === null) {
        await this.ctx.storage.setAlarm(now + LEDGER_WINDOW_MS + 60_000);
      }
    }
    return Response.json({ decision });
  }

  // Deletes expired hashes even when no further requests arrive; re-arms while any remain.
  async alarm() {
    const now = Date.now();
    this.sql.exec('DELETE FROM deliveries WHERE sent_at <= ?', now - LEDGER_WINDOW_MS);
    const oldest = this.sql.exec('SELECT MIN(sent_at) AS oldest FROM deliveries').one().oldest;
    if (oldest !== null) await this.ctx.storage.setAlarm(oldest + LEDGER_WINDOW_MS + 60_000);
  }
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin'
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) }
  });
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[character]);
}

function isValidTurnstileVerification(result) {
  return Boolean(
    result &&
    typeof result === 'object' &&
    !Array.isArray(result) &&
    result.success === true &&
    typeof result.hostname === 'string' &&
    ALLOWED_TURNSTILE_HOSTNAMES.has(result.hostname) &&
    result.action === CONFIRMATION_TURNSTILE_ACTION
  );
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (!ALLOWED_ORIGINS.has(origin)) {
      return new Response('Forbidden', { status: 403 });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/confirm') {
      return json({ ok: false, error: 'Not found' }, 404, origin);
    }

    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimit = await env.CONFIRM_RATE_LIMITER.limit({
      key: 'confirm:' + clientIp
    });

    if (!rateLimit.success) {
      return json({ ok: false, error: 'Too many submissions. Please try again in a minute.' }, 429, origin);
    }

    const contentType = (request.headers.get('Content-Type') || '')
      .split(';', 1)[0]
      .trim()
      .toLowerCase();

    if (contentType !== 'application/json') {
      return json({ ok: false, error: 'Content-Type must be application/json' }, 415, origin);
    }

    const contentLength = Number(request.headers.get('Content-Length') || 0);
    if (contentLength > 10000) {
      return json({ ok: false, error: 'Request too large' }, 413, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'Invalid request' }, 400, origin);
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ ok: false, error: 'Invalid request' }, 400, origin);
    }

    const email = String(body.email || '').trim().toLowerCase();
    const name = displayText(body.name, NAME_MAX_LENGTH);
    const tankName = displayText(body.tankName, TANK_NAME_MAX_LENGTH);
    const turnstileToken = String(body.turnstileToken || '');

    if (body.website) {
      return json({ ok: true }, 200, origin);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !turnstileToken || turnstileToken.length > 2048) {
      return json({ ok: false, error: 'Invalid submission' }, 400, origin);
    }

    if (!env.CONFIRM_LEDGER || typeof env.CONFIRM_DEDUP_KEY !== 'string' || env.CONFIRM_DEDUP_KEY.length < 32) {
      console.error('Confirmation ledger is not configured');
      return json({ ok: false, error: 'Email could not be sent' }, 503, origin);
    }

    const verification = new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: turnstileToken,
      remoteip: request.headers.get('CF-Connecting-IP') || ''
    });

    let turnstile;
    try {
      const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: verification
      });
      if (!turnstileResponse.ok) {
        return json({ ok: false, error: 'Security check failed' }, 400, origin);
      }
      turnstile = await turnstileResponse.json();
    } catch {
      return json({ ok: false, error: 'Security check failed' }, 400, origin);
    }

    if (!isValidTurnstileVerification(turnstile)) {
      return json({ ok: false, error: 'Security check failed' }, 400, origin);
    }

    // One delivery per recipient and tank name in 24 hours; a repeat is reported as sent.
    const recipientHash = await keyedHash(env.CONFIRM_DEDUP_KEY, 'recipient', email);
    const deliveryHash = await keyedHash(env.CONFIRM_DEDUP_KEY, 'delivery', email + '\n' + String(body.tankName || '').trim().toLowerCase());

    let reservation;
    try {
      reservation = await callLedger(env, '/reserve', { deliveryHash, recipientHash, dailyCap: dailyDeliveryCap(env) });
    } catch (error) {
      console.error('Confirmation ledger unavailable', error.message);
      return json({ ok: false, error: 'Email could not be sent' }, 503, origin);
    }

    if (reservation.decision === 'duplicate') {
      return json({ ok: true }, 200, origin);
    }
    if (reservation.decision !== 'reserved') {
      console.warn('Confirmation email withheld:', reservation.decision);
      return json({ ok: false, error: 'Email could not be sent' }, 429, origin);
    }

    const safeName = escapeHtml(name || 'there');
    const safeTank = escapeHtml(tankName);
    const tankLine = safeTank ? '<p>Tank: <strong>' + safeTank + '</strong></p>' : '';
    const ignoreLine = 'If you did not submit a tank to The Tank Guide, no action is needed and you can ignore this email.';
    const html = '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#16323f;max-width:600px">' +
      '<h2>Thanks for sharing your tank!</h2>' +
      '<p>Hi ' + safeName + ',</p>' +
      '<p>We received your Feature Your Tank submission. Our team will review it and contact you if we need anything else.</p>' +
      tankLine +
      '<p>— The Tank Guide</p>' +
      '<p style="font-size:12px;color:#5b6b73">' + ignoreLine + '</p></div>';
    const text = 'Hi ' + (name || 'there') + ',\n\n' +
      'We received your Feature Your Tank submission. Our team will review it and contact you if we need anything else.\n' +
      (tankName ? '\nTank: ' + tankName + '\n' : '') +
      '\n— The Tank Guide\n\n' + ignoreLine + '\n';

    let resendResponse;
    try {
      resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + env.RESEND_API_KEY,
          'Content-Type': 'application/json',
          'Idempotency-Key': deliveryHash
        },
        body: JSON.stringify({
          from: 'The Tank Guide <features@thetankguide.com>',
          to: [email],
          subject: 'We received your tank submission',
          html,
          text,
          reply_to: 'fishkeepinglifeco@thetankguide.com'
        })
      });
    } catch {
      resendResponse = null;
    }

    if (!resendResponse || !resendResponse.ok) {
      console.error('Resend request failed', resendResponse ? resendResponse.status : 'network error');
      // Free the reservation so the visitor's retry is not counted as a delivery.
      await callLedger(env, '/release', { deliveryHash }).catch(() => {});
      return json({ ok: false, error: 'Email could not be sent' }, 502, origin);
    }

    return json({ ok: true }, 200, origin);
  }
};
