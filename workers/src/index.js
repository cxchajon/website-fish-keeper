import { getEnvConfig } from './config.js';

const ALLOWED_METHODS = 'GET, POST, OPTIONS';

function createCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Stripe-Signature',
  };
}

function withCors(response, origin) {
  const headers = new Headers(response.headers);
  const corsHeaders = createCorsHeaders(origin);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function notImplemented() {
  return new Response(JSON.stringify({ message: 'Not implemented yet' }), {
    status: 501,
    headers: { 'Content-Type': 'application/json' },
  });
}

function handleOptions(origin) {
  return withCors(
    new Response(null, {
      status: 204,
    }),
    origin,
  );
}

export default {
  async fetch(request, env) {
    const { ENVIRONMENT, SITE_URL } = getEnvConfig(env);
    const url = new URL(request.url);
    console.log(`[${ENVIRONMENT}] ${request.method} ${url.pathname}`);

    const origin = SITE_URL;

    if (request.method === 'OPTIONS') {
      return handleOptions(origin);
    }

    let response;

    if (request.method === 'POST' && url.pathname === '/api/submissions/create') {
      response = notImplemented();
    } else if (request.method === 'POST' && url.pathname === '/api/webhooks/stripe') {
      response = notImplemented();
    } else if (request.method === 'GET' && url.pathname === '/api/admin/submissions') {
      response = notImplemented();
    } else {
      response = new Response('Not found', { status: 404 });
    }

    return withCors(response, origin);
  },
};
