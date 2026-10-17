const ALLOWED_ORIGINS = new Set([
  'https://thetankguide.com',
  'https://www.thetankguide.com'
]);

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

    const email = String(body.email || '').trim().toLowerCase();
    const name = String(body.name || '').trim().slice(0, 100);
    const tankName = String(body.tankName || '').trim().slice(0, 120);
    const turnstileToken = String(body.turnstileToken || '');

    if (body.website) {
      return json({ ok: true }, 200, origin);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !turnstileToken) {
      return json({ ok: false, error: 'Invalid submission' }, 400, origin);
    }

    const verification = new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: turnstileToken,
      remoteip: request.headers.get('CF-Connecting-IP') || ''
    });

    const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: verification
    });
    const turnstile = await turnstileResponse.json();

    if (!turnstile.success) {
      return json({ ok: false, error: 'Security check failed' }, 400, origin);
    }

    const safeName = escapeHtml(name || 'there');
    const safeTank = escapeHtml(tankName);
    const tankLine = safeTank ? '<p>Tank: <strong>' + safeTank + '</strong></p>' : '';
    const html = '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#16323f;max-width:600px">' +
      '<h2>Thanks for sharing your tank!</h2>' +
      '<p>Hi ' + safeName + ',</p>' +
      '<p>We received your Feature Your Tank submission. Our team will review it and contact you if we need anything else.</p>' +
      tankLine +
      '<p>— The Tank Guide</p></div>';

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'The Tank Guide <features@thetankguide.com>',
        to: [email],
        subject: 'We received your tank submission',
        html,
        reply_to: 'fishkeepinglifeco@thetankguide.com'
      })
    });

    if (!resendResponse.ok) {
      console.error('Resend request failed', resendResponse.status);
      return json({ ok: false, error: 'Email could not be sent' }, 502, origin);
    }

    return json({ ok: true }, 200, origin);
  }
};
