import { getEnvConfig } from './config.js';
import bcrypt from 'bcryptjs';

const ALLOWED_METHODS = 'GET, POST, OPTIONS';
const ADMIN_COOKIE_NAME = 'Admin-Session';
const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

function createCorsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Stripe-Signature',
    'Access-Control-Allow-Credentials': 'true',
  };
}

function withCors(response, origin) {
  const headers = new Headers(response.headers);
  const corsHeaders = createCorsHeaders(origin);
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function handleOptions(origin) {
  return withCors(new Response(null, { status: 204 }), origin);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');
}

function toBoolean(value) {
  if (!value) return false;
  const normalized = `${value}`.toLowerCase();
  return ['true', '1', 'yes', 'on'].includes(normalized);
}

function calculateSimilarity(str1 = '', str2 = '') {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;

  const bigrams = new Map();
  for (let i = 0; i < s1.length - 1; i++) {
    const gram = s1.slice(i, i + 2);
    bigrams.set(gram, (bigrams.get(gram) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const gram = s2.slice(i, i + 2);
    const count = bigrams.get(gram) || 0;
    if (count > 0) {
      bigrams.set(gram, count - 1);
      intersection += 2;
    }
  }

  return intersection / (s1.length + s2.length);
}

async function generateSubmissionId(db) {
  const result = await db.prepare("SELECT id FROM submissions WHERE id LIKE 'FT-%' ORDER BY id DESC LIMIT 1").first();
  if (!result || !result.id) {
    return 'FT-0001';
  }

  const numeric = parseInt(result.id.replace('FT-', ''), 10) || 0;
  const next = numeric + 1;
  return `FT-${next.toString().padStart(4, '0')}`;
}

async function createStripeSession({
  secretKey,
  email,
  lineItems,
  submissionId,
  tankName,
  creditsPurchased,
}) {
  const params = new URLSearchParams();
  params.append('customer_email', email);
  params.append('mode', 'payment');
  params.append('success_url', 'https://thetankguide.com/feature-your-tank-confirmation?session_id={CHECKOUT_SESSION_ID}');
  params.append('cancel_url', 'https://thetankguide.com/submit-your-tank.html?cancelled=true');

  lineItems.forEach((item, index) => {
    params.append(`line_items[${index}][price]`, item.price);
    params.append(`line_items[${index}][quantity]`, `${item.quantity}`);
  });

  params.append('metadata[submission_id]', submissionId);
  params.append('metadata[user_email]', email);
  params.append('metadata[tank_name]', tankName);
  params.append('metadata[credits_purchased]', `${creditsPurchased}`);

  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': submissionId,
    },
    body: params.toString(),
  });

  if (!stripeResponse.ok) {
    const errorText = await stripeResponse.text();
    throw new Error(`Stripe session creation failed: ${stripeResponse.status} ${errorText}`);
  }

  return stripeResponse.json();
}

async function verifyStripeSignature(request, secret) {
  const signatureHeader = request.headers.get('Stripe-Signature');
  if (!signatureHeader) {
    return { valid: false, rawBody: null };
  }

  const parsed = signatureHeader.split(',').reduce((acc, part) => {
    const [key, value] = part.split('=');
    acc[key] = value;
    return acc;
  }, {});

  const timestamp = parsed.t;
  const signature = parsed.v1;
  if (!timestamp || !signature) {
    return { valid: false, rawBody: null };
  }

  const rawBody = await request.text();
  const payload = `${timestamp}.${rawBody}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const signingKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signatureBuffer = await crypto.subtle.sign('HMAC', signingKey, encoder.encode(payload));
  const expected = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const hexToUint8 = (hex) => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  };

  const signatureBytes = hexToUint8(signature);
  const expectedBytes = hexToUint8(expected);

  if (signatureBytes.length !== expectedBytes.length) {
    return { valid: false, rawBody };
  }

  let diff = 0;
  for (let i = 0; i < signatureBytes.length; i++) {
    diff |= signatureBytes[i] ^ expectedBytes[i];
  }

  const valid = diff === 0;

  const toleranceSeconds = 300;
  const withinTolerance = Math.abs(Date.now() / 1000 - Number(timestamp)) <= toleranceSeconds;

  return { valid: valid && withinTolerance, rawBody };
}

async function fetchPaymentIntentMetadata(paymentIntentId, secretKey) {
  const response = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });

  if (!response.ok) {
    console.error('Failed to retrieve payment intent metadata', await response.text());
    return {};
  }

  const paymentIntent = await response.json();
  return paymentIntent.metadata || {};
}

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((acc, cookie) => {
    const [name, ...rest] = cookie.trim().split('=');
    if (!name) return acc;
    acc[name] = rest.join('=');
    return acc;
  }, {});
}

function getAuthCookieValue(env) {
  if (!env.ADMIN_PASSWORD_HASH) return null;
  return env.ADMIN_PASSWORD_HASH.slice(0, 24);
}

function isAuthenticated(request, env) {
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  return cookies[ADMIN_COOKIE_NAME] === getAuthCookieValue(env);
}

function buildSubmissionReceivedEmail({ name, submissionId, tankName }) {
  return `
    <div style="font-family: Arial, sans-serif; color: #0b1e26;">
      <p>Hi ${name},</p>
      <p>Thanks for sharing your tank with us! Here are the details we received:</p>
      <ul>
        <li><strong>Submission ID:</strong> ${submissionId}</li>
        <li><strong>Tank:</strong> ${tankName}</li>
        <li><strong>Status:</strong> Queued for review</li>
        <li><strong>Next steps:</strong> We'll review within 5-7 days</li>
        <li><strong>Payment:</strong> No payment required!</li>
      </ul>
      <p>If you have updates, just reply to this email.</p>
    </div>
  `;
}

function buildPaymentConfirmedEmail({ name, tankName, submissionId, amount, creditsRemaining }) {
  return `
    <div style="font-family: Arial, sans-serif; color: #0b1e26;">
      <p>Hi ${name},</p>
      <p>Your payment is confirmed. Here are your details:</p>
      <ul>
        <li><strong>Payment received:</strong> $${amount.toFixed(2)}</li>
        <li><strong>Submission ID:</strong> ${submissionId}</li>
        <li><strong>Tank:</strong> ${tankName}</li>
        <li><strong>Editing credits:</strong> ${creditsRemaining}</li>
        <li><strong>Next steps:</strong> First draft within 5-7 days</li>
        <li><strong>Reminder:</strong> Credits never expire!</li>
      </ul>
      <p>We'll keep you posted as we make progress.</p>
    </div>
  `;
}

function buildPublishedEmail({ name, publishedUrl, creditsRemaining }) {
  const encodedUrl = encodeURIComponent(publishedUrl || '');
  return `
    <div style="font-family: Arial, sans-serif; color: #0b1e26;">
      <p>Hi ${name},</p>
      <p>Your feature is now live!</p>
      <p><a href="${publishedUrl}" style="color: #0d7680;">View it here</a></p>
      <p>Share your tank:</p>
      <div>
        <a href="https://twitter.com/intent/tweet?url=${encodedUrl}" style="margin-right: 10px;">Share on X</a>
        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" style="margin-right: 10px;">Share on Facebook</a>
        <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}">Share on LinkedIn</a>
      </div>
      <p><strong>Credits remaining:</strong> ${creditsRemaining}</p>
      <p>Thanks for being part of the community!</p>
    </div>
  `;
}

async function sendEmail(env, to, subject, html) {
  if (!env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured');
    return { error: 'Missing API key' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'features@thetankguide.com',
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Resend error', response.status, errorText);
    return { error: errorText };
  }

  return response.json();
}

async function handleSubmissionCreate(request, env) {
  try {
    const formData = await request.formData();
    const name = formData.get('name');
    const email = formData.get('email');
    const tankName = formData.get('tank_name');
    const tankSize = Number(formData.get('tank_size'));
    const environment = formData.get('environment');
    const youtube = formData.get('youtube');
    const instagram = formData.get('instagram');
    const tiktok = formData.get('tiktok');
    const textSource = formData.get('text_source') || 'user';
    const isFirstTank = formData.get('is_first_tank');
    const additionalTanks = Number(formData.get('additional_tanks') || 0);
    const extraPhotos = toBoolean(formData.get('extra_photos'));
    const extraPhotosAdditional = toBoolean(formData.get('extra_photos_additional'));
    const newsletterOptIn = toBoolean(formData.get('newsletter_opt_in'));

    const requiredFields = [name, email, tankName, tankSize, environment, textSource, isFirstTank];
    const consentFields = [
      formData.get('new_tank_confirm'),
      formData.get('license_confirm'),
      formData.get('guidelines_confirm'),
      formData.get('permission_contact'),
      formData.get('pricing_confirm'),
    ];

    if (requiredFields.some((field) => field === null || field === undefined || field === '')) {
      return new Response(JSON.stringify({ error: 'Missing required fields.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (consentFields.some((field) => !field)) {
      return new Response(JSON.stringify({ error: 'All consent checkboxes are required.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!validateEmail(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email address.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!['planted', 'unplanted'].includes(environment)) {
      return new Response(JSON.stringify({ error: 'Invalid environment selection.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!['user', 'fklc'].includes(textSource)) {
      return new Response(JSON.stringify({ error: 'Invalid text source.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!['yes', 'no'].includes(isFirstTank)) {
      return new Response(JSON.stringify({ error: 'Invalid tank submission type.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!Number.isFinite(tankSize) || tankSize <= 0) {
      return new Response(JSON.stringify({ error: 'Tank size must be a positive number.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!Number.isInteger(additionalTanks) || additionalTanks < 0 || additionalTanks > 4) {
      return new Response(JSON.stringify({ error: 'Additional tanks must be between 0 and 4.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const submissionId = await generateSubmissionId(env.DB);

    const previousSubmissions = await env.DB.prepare('SELECT id, tank_name FROM submissions WHERE user_email = ?').bind(email).all();
    let duplicateScore = 0;
    if (previousSubmissions?.results?.length) {
      duplicateScore = previousSubmissions.results.reduce((max, row) => Math.max(max, calculateSimilarity(row.tank_name || '', tankName)), 0);
    }

    const flaggedAsDuplicate = duplicateScore > 0.8 ? 1 : 0;

    const photos = formData.getAll('photos').map((photo) => `${photo}`);

    const editingPackagePurchased = textSource === 'fklc' && isFirstTank === 'yes';
    const editingPackagePrice = editingPackagePurchased ? 1 : 0;
    const baseAdditionalCount = isFirstTank === 'no' ? Math.max(1, additionalTanks) : 0;
    const additionalTanksPrice = baseAdditionalCount * 2;
    const extraPhotosPrice = extraPhotos ? 1 : 0;
    const extraPhotosAdditionalPrice = baseAdditionalCount > 0 && extraPhotosAdditional ? baseAdditionalCount * 1 : 0;
    const totalPrice = editingPackagePrice + additionalTanksPrice + extraPhotosPrice + extraPhotosAdditionalPrice;
    const totalCredits = editingPackagePurchased ? 3 : 0;

    const paymentStatus = totalPrice > 0 ? 'pending' : 'free';
    const status = totalPrice > 0 ? 'payment_pending' : 'submitted';

    await env.DB.prepare(
      `INSERT INTO submissions (
          id, user_name, user_email, youtube, instagram, tiktok, tank_name, tank_size, environment, photos, text_source, text_content,
          editing_package_purchased, extra_photos_purchased, is_first_tank, base_price, total_price, payment_status,
          stripe_checkout_session_id, stripe_payment_intent_id, total_credits_purchased, credits_used, status, revisions,
          published_at, published_url, duplicate_check_score, flagged_as_duplicate, admin_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        submissionId,
        name,
        email,
        youtube,
        instagram,
        tiktok,
        tankName,
        tankSize,
        environment,
        JSON.stringify(photos),
        textSource,
        null,
        editingPackagePurchased ? 1 : 0,
        extraPhotos || extraPhotosAdditional ? 1 : 0,
        isFirstTank === 'yes' ? 1 : 0,
        baseAdditionalCount > 0 ? additionalTanksPrice : 0,
        totalPrice,
        paymentStatus,
        null,
        null,
        totalCredits,
        0,
        status,
        null,
        null,
        null,
        duplicateScore,
        flaggedAsDuplicate,
        null,
      )
      .run();

    const existingUser = await env.DB.prepare('SELECT total_submissions, first_tank_discount_used, newsletter_subscribed FROM users WHERE email = ?').bind(email).first();
    if (existingUser) {
      const firstTankDiscountUsed = existingUser.first_tank_discount_used ? 1 : isFirstTank === 'yes' ? 1 : 0;
      await env.DB.prepare(
        'UPDATE users SET name = ?, total_submissions = ?, first_tank_discount_used = ?, newsletter_subscribed = ?, last_submission = CURRENT_TIMESTAMP WHERE email = ?',
      )
        .bind(
          name,
          (existingUser.total_submissions || 0) + 1,
          firstTankDiscountUsed,
          newsletterOptIn ? 1 : existingUser.newsletter_subscribed,
          email,
        )
        .run();
    } else {
      await env.DB.prepare(
        'INSERT INTO users (email, name, total_submissions, first_tank_discount_used, newsletter_subscribed, last_submission) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      )
        .bind(email, name, 1, isFirstTank === 'yes' ? 1 : 0, newsletterOptIn ? 1 : 0)
        .run();
    }

    if (totalPrice === 0) {
      const html = buildSubmissionReceivedEmail({ name, submissionId, tankName });
      sendEmail(env, email, `✓ Submission Received - ${tankName}`, html).catch((error) => console.error('Failed to send submission received email', error));

      return new Response(JSON.stringify({ success: true, submission_id: submissionId, checkout_url: null, payment_status: paymentStatus }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!env.STRIPE_SECRET_KEY) {
      console.error('Stripe secret key is missing');
      return new Response(JSON.stringify({ error: 'Payment configuration is unavailable.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const lineItems = [];
    if (editingPackagePurchased) {
      lineItems.push({ price: 'price_1SXVkgDHdZPeBj86nRifUs0J', quantity: 1 });
    }
    if (extraPhotos) {
      lineItems.push({ price: 'price_1SXb7wDHdZPeBj86fbJYidJX', quantity: 1 });
    }
    if (baseAdditionalCount > 0) {
      lineItems.push({ price: 'price_1SXX9SDHdZPeBj86Ib1WsYwK', quantity: baseAdditionalCount });
    }
    if (extraPhotosAdditionalPrice > 0) {
      lineItems.push({ price: 'price_1SXXByDHdZPeBj86d4zuxQwv', quantity: baseAdditionalCount });
    }

    try {
      const session = await createStripeSession({
        secretKey: env.STRIPE_SECRET_KEY,
        email,
        lineItems,
        submissionId,
        tankName,
        creditsPurchased: totalCredits,
      });

      await env.DB.prepare('UPDATE submissions SET stripe_checkout_session_id = ? WHERE id = ?')
        .bind(session.id, submissionId)
        .run();

      return new Response(
        JSON.stringify({
          success: true,
          submission_id: submissionId,
          checkout_url: session.url,
          payment_status: 'pending',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      console.error('Stripe session error', error);
      return new Response(JSON.stringify({ error: 'Unable to start payment session.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('Submission create error', error);
    return new Response(JSON.stringify({ error: 'Failed to create submission.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function handleStripeWebhook(request, env) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return new Response('Webhook secret not configured', { status: 500 });
  }

  const { valid, rawBody } = await verifyStripeSignature(request.clone(), env.STRIPE_WEBHOOK_SECRET);
  if (!valid || !rawBody) {
    return new Response('Invalid signature', { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (error) {
    console.error('Webhook parse error', error);
    return new Response('Invalid payload', { status: 400 });
  }

  const type = event.type;
  const dataObject = event.data?.object || {};
  let metadata = dataObject.metadata || {};
  let submissionId = metadata.submission_id;

  if (!submissionId && dataObject.payment_intent) {
    if (!env.STRIPE_SECRET_KEY) {
      return new Response('Payment configuration missing', { status: 500 });
    }
    const paymentIntentMetadata = await fetchPaymentIntentMetadata(dataObject.payment_intent, env.STRIPE_SECRET_KEY);
    metadata = { ...metadata, ...paymentIntentMetadata };
    submissionId = paymentIntentMetadata.submission_id;
  }

  if (!submissionId) {
    console.warn('Webhook missing submission_id');
    return new Response('Missing submission id', { status: 400 });
  }

  const submission = await env.DB.prepare('SELECT payment_status, total_credits_purchased FROM submissions WHERE id = ?')
    .bind(submissionId)
    .first();

  if (!submission) {
    return new Response('Submission not found', { status: 404 });
  }

  if (type === 'checkout.session.completed') {
    if (submission.payment_status === 'paid') {
      return new Response('Already processed', { status: 200 });
    }

    const paymentIntent = dataObject.payment_intent;
    await env.DB.prepare('UPDATE submissions SET payment_status = ?, stripe_payment_intent_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind('paid', paymentIntent, 'submitted', submissionId)
      .run();

    if (submission.total_credits_purchased > 0) {
      const creditId = crypto.randomUUID();
      await env.DB.prepare(
        'INSERT INTO credit_purchases (id, submission_id, user_email, purchase_date, credits_added, amount, stripe_payment_intent_id, reason, status) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)',
      )
        .bind(
          creditId,
          submissionId,
          dataObject.customer_details?.email || metadata?.user_email,
          submission.total_credits_purchased,
          dataObject.amount_total ? dataObject.amount_total / 100 : null,
          paymentIntent,
          'initial',
          'active',
        )
        .run();
    }

    const details = await env.DB.prepare('SELECT user_name, user_email, tank_name, total_price, total_credits_purchased, credits_used FROM submissions WHERE id = ?')
      .bind(submissionId)
      .first();

    if (details) {
      const amount = dataObject.amount_total ? dataObject.amount_total / 100 : details.total_price || 0;
      const creditsRemaining = (details.total_credits_purchased || 0) - (details.credits_used || 0);
      const html = buildPaymentConfirmedEmail({
        name: details.user_name || 'there',
        tankName: details.tank_name || metadata.tank_name || 'your tank',
        submissionId,
        amount,
        creditsRemaining,
      });
      sendEmail(env, details.user_email, `Payment Confirmed - ${details.tank_name || metadata.tank_name || 'Tank'}`, html).catch((error) =>
        console.error('Failed to send payment confirmation email', error),
      );
    }
  } else if (type === 'checkout.session.expired') {
    await env.DB.prepare('UPDATE submissions SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind('pending', submissionId).run();
  } else if (type === 'charge.refunded') {
    const paymentIntent = dataObject.payment_intent;
    await env.DB.prepare('UPDATE submissions SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind('refunded', submissionId).run();
    await env.DB.prepare('UPDATE credit_purchases SET status = ? WHERE submission_id = ? OR stripe_payment_intent_id = ?')
      .bind('refunded', submissionId, paymentIntent)
      .run();
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}

async function handleHealth(env) {
  try {
    const dbCheck = await env.DB.prepare('SELECT 1 as ok').first();
    return new Response(
      JSON.stringify({ status: 'ok', timestamp: new Date().toISOString(), db: dbCheck?.ok ? 'connected' : 'unknown' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Health check failed', error);
    return new Response(JSON.stringify({ status: 'error', timestamp: new Date().toISOString(), db: 'error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function unauthorizedResponse() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
}

async function handleAdminLogin(request, env) {
  if (!env.ADMIN_PASSWORD_HASH) {
    return new Response(JSON.stringify({ error: 'Admin login not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json().catch(() => ({}));
  const password = body.password;
  if (!password) {
    return new Response(JSON.stringify({ error: 'Password required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const valid = await bcrypt.compare(password, env.ADMIN_PASSWORD_HASH);
  if (!valid) {
    return unauthorizedResponse();
  }

  const cookieValue = getAuthCookieValue(env);
  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append(
    'Set-Cookie',
    `${ADMIN_COOKIE_NAME}=${cookieValue}; Max-Age=${COOKIE_MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax`,
  );

  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
}

function creditsRemaining(row) {
  return (row.total_credits_purchased || 0) - (row.credits_used || 0);
}

async function handleAdminSubmissions(request, env) {
  if (!isAuthenticated(request, env)) {
    return unauthorizedResponse();
  }

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status');
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100);
  const offset = Number(url.searchParams.get('offset')) || 0;

  const whereClause = statusFilter ? 'WHERE status = ?' : '';
  const submissionsQuery = env.DB.prepare(
    `SELECT id, tank_name, user_email, status, total_price, total_credits_purchased, credits_used, created_at FROM submissions ${whereClause} ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?`,
  );

  const query = statusFilter ? submissionsQuery.bind(statusFilter, limit, offset) : submissionsQuery.bind(limit, offset);
  const { results } = await query.all();

  const countQuery = env.DB.prepare(`SELECT COUNT(*) as count FROM submissions ${whereClause}`);
  const countResult = statusFilter ? await countQuery.bind(statusFilter).first() : await countQuery.first();
  const total = countResult?.count || 0;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.max(1, Math.ceil(total / limit));

  const submissions = (results || []).map((row) => ({
    id: row.id,
    tank_name: row.tank_name,
    user_email: row.user_email,
    status: row.status,
    total_price: row.total_price,
    credits_remaining: creditsRemaining(row),
    created_at: row.created_at,
  }));

  return new Response(
    JSON.stringify({ submissions, total, page, pages }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

async function handleAdminSubmissionDetail(request, env, submissionId) {
  if (!isAuthenticated(request, env)) {
    return unauthorizedResponse();
  }

  const submission = await env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(submissionId).first();
  if (!submission) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify(submission), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function handleAdminStatusUpdate(request, env, submissionId) {
  if (!isAuthenticated(request, env)) {
    return unauthorizedResponse();
  }

  const body = await request.json().catch(() => ({}));
  const status = body.status;
  const publishedUrl = body.published_url;

  if (!status) {
    return new Response(JSON.stringify({ error: 'Status is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const submission = await env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(submissionId).first();
  if (!submission) {
    return new Response(JSON.stringify({ error: 'Submission not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }

  await env.DB.prepare('UPDATE submissions SET status = ?, published_url = COALESCE(?, published_url), published_at = CASE WHEN ? = "published" THEN CURRENT_TIMESTAMP ELSE published_at END, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(status, publishedUrl, status, submissionId)
    .run();

  const updated = await env.DB.prepare('SELECT * FROM submissions WHERE id = ?').bind(submissionId).first();

  if (status === 'published') {
    const remaining = creditsRemaining(updated);
    const html = buildPublishedEmail({
      name: updated.user_name || 'there',
      publishedUrl: publishedUrl || updated.published_url || 'https://thetankguide.com',
      creditsRemaining: remaining,
    });
    sendEmail(env, updated.user_email, 'Your Tank is Live! 🎉', html).catch((error) => console.error('Failed to send published email', error));
  }

  return new Response(JSON.stringify(updated), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

async function handleAdminStats(request, env) {
  if (!isAuthenticated(request, env)) {
    return unauthorizedResponse();
  }

  const totalRow = await env.DB.prepare('SELECT COUNT(*) as count FROM submissions').first();
  const revenueRow = await env.DB.prepare("SELECT COALESCE(SUM(total_price), 0) as revenue FROM submissions WHERE payment_status = 'paid'").first();
  const avgCreditsRow = await env.DB.prepare('SELECT COALESCE(AVG(credits_used), 0) as avg_credits_used FROM submissions').first();
  const statusRows = await env.DB.prepare('SELECT status, COUNT(*) as count FROM submissions GROUP BY status').all();

  const statusCounts = (statusRows?.results || []).reduce((acc, row) => {
    acc[row.status] = row.count;
    return acc;
  }, {});

  return new Response(
    JSON.stringify({
      total_submissions: totalRow?.count || 0,
      total_revenue: revenueRow?.revenue || 0,
      avg_credits_used: avgCreditsRow?.avg_credits_used || 0,
      status_counts: statusCounts,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function renderAdminPage(authenticated) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Admin Dashboard</title>
<style>
  body { font-family: Arial, sans-serif; background: #f4f8fa; margin: 0; padding: 0; color: #0b1e26; }
  header { background: #0d7680; color: white; padding: 16px; text-align: center; }
  .container { padding: 16px; }
  .card { background: white; border-radius: 8px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e3edf2; }
  th { background: #f0f6f8; position: sticky; top: 0; }
  tr:hover { background: #f7fbfc; cursor: pointer; }
  .controls { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; align-items: center; }
  .btn { background: #0d7680; color: white; border: none; padding: 10px 14px; border-radius: 6px; cursor: pointer; }
  .btn.secondary { background: #113746; }
  .tag { display: inline-block; padding: 4px 8px; border-radius: 4px; background: #e3edf2; color: #0b1e26; font-size: 12px; }
  .hidden { display: none; }
  @media (max-width: 720px) {
    table, thead, tbody, th, td, tr { display: block; }
    th { position: static; }
    tr { margin-bottom: 12px; border: 1px solid #e3edf2; border-radius: 6px; padding: 8px; }
    td { border: none; padding: 6px 0; }
    td::before { content: attr(data-label); font-weight: bold; display: block; margin-bottom: 4px; color: #113746; }
  }
</style>
</head>
<body>
<header><h1>Feature Tank Admin</h1></header>
<div class="container">
  <div id="loginCard" class="card ${authenticated ? 'hidden' : ''}">
    <h2>Admin Login</h2>
    <p>Enter the admin password to continue.</p>
    <input id="passwordInput" type="password" placeholder="Password" style="width: 100%; padding: 10px; margin: 8px 0;" />
    <button class="btn" onclick="login()">Login</button>
    <p id="loginError" style="color: #c0392b;"></p>
  </div>

  <div id="dashboard" class="${authenticated ? '' : 'hidden'}">
    <div class="card">
      <div class="controls">
        <div>
          <label for="statusFilter">Filter by status:</label>
          <select id="statusFilter" onchange="loadSubmissions(1)">
            <option value="">All</option>
            <option value="submitted">Submitted</option>
            <option value="payment_pending">Payment Pending</option>
            <option value="in_review">In Review</option>
            <option value="awaiting_first_draft">Awaiting First Draft</option>
            <option value="draft_ready">Draft Ready</option>
            <option value="awaiting_user_approval">Awaiting User Approval</option>
            <option value="published">Published</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <button class="btn secondary" onclick="refreshStats()">Refresh Stats</button>
      </div>
      <div id="stats" style="margin-bottom: 10px; color: #113746;"></div>
      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Tank</th>
              <th>Email</th>
              <th>Status</th>
              <th>Credits</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="submissionRows"></tbody>
        </table>
      </div>
    </div>

    <div id="detailCard" class="card hidden">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h3>Submission Details</h3>
        <button class="btn secondary" onclick="hideDetails()">Close</button>
      </div>
      <pre id="submissionDetail" style="white-space: pre-wrap; background: #f7fbfc; padding: 10px; border-radius: 6px;"></pre>
      <div style="margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn" onclick="markPublished()">Mark as Published</button>
      </div>
    </div>
  </div>
</div>
<script>
  let currentPage = 1;
  let currentSubmissionId = null;
  const isAuthed = ${authenticated ? 'true' : 'false'};

  async function login() {
    const password = document.getElementById('passwordInput').value;
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (res.ok) {
      document.getElementById('loginCard').classList.add('hidden');
      document.getElementById('dashboard').classList.remove('hidden');
      loadSubmissions();
      refreshStats();
    } else {
      const data = await res.json().catch(() => ({}));
      document.getElementById('loginError').innerText = data.error || 'Login failed';
    }
  }

  function hideDetails() {
    document.getElementById('detailCard').classList.add('hidden');
    currentSubmissionId = null;
  }

  async function loadSubmissions(page = 1) {
    currentPage = page;
    const status = document.getElementById('statusFilter').value;
    const res = await fetch(`/api/admin/submissions?limit=20&offset=${(page-1)*20}${status ? `&status=${encodeURIComponent(status)}` : ''}`, { credentials: 'include' });
    if (res.status === 401) {
      document.getElementById('dashboard').classList.add('hidden');
      document.getElementById('loginCard').classList.remove('hidden');
      return;
    }
    const data = await res.json();
    const tbody = document.getElementById('submissionRows');
    tbody.innerHTML = '';
    data.submissions.forEach((row) => {
      const tr = document.createElement('tr');
      tr.onclick = () => showDetails(row.id);
      tr.innerHTML = `
        <td data-label="ID">${row.id}</td>
        <td data-label="Tank">${row.tank_name || ''}</td>
        <td data-label="Email">${row.user_email}</td>
        <td data-label="Status"><span class="tag">${row.status}</span></td>
        <td data-label="Credits">${row.credits_remaining}</td>
        <td data-label="Created">${row.created_at ? new Date(row.created_at).toLocaleString() : ''}</td>
        <td data-label="Action"><button class="btn" onclick="event.stopPropagation(); showDetails('${row.id}')">View</button></td>`;
      tbody.appendChild(tr);
    });
  }

  async function showDetails(id) {
    currentSubmissionId = id;
    const res = await fetch(`/api/admin/submissions/${id}`, { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById('submissionDetail').textContent = JSON.stringify(data, null, 2);
    document.getElementById('detailCard').classList.remove('hidden');
  }

  async function markPublished() {
    if (!currentSubmissionId) return;
    const publishedUrl = prompt('Enter published URL (optional):', '');
    const res = await fetch(`/api/admin/submissions/${currentSubmissionId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status: 'published', published_url: publishedUrl || undefined })
    });
    if (res.ok) {
      const data = await res.json();
      document.getElementById('submissionDetail').textContent = JSON.stringify(data, null, 2);
      loadSubmissions(currentPage);
      alert('Marked as published and email sent.');
    } else {
      alert('Failed to update status');
    }
  }

  async function refreshStats() {
    const res = await fetch('/api/admin/stats', { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById('stats').innerText = `Total submissions: ${data.total_submissions} | Revenue: $${Number(data.total_revenue).toFixed(2)} | Avg credits used: ${Number(data.avg_credits_used).toFixed(2)}`;
  }

  if (isAuthed) {
    loadSubmissions();
    refreshStats();
  }
</script>
</body>
</html>`;
}

async function handleAdminPage(request, env) {
  const authenticated = isAuthenticated(request, env);
  const html = renderAdminPage(authenticated);
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
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
    const pathname = url.pathname;

    if (request.method === 'POST' && pathname === '/api/submissions/create') {
      response = await handleSubmissionCreate(request, env);
    } else if (request.method === 'POST' && pathname === '/api/webhooks/stripe') {
      response = await handleStripeWebhook(request, env);
    } else if (request.method === 'GET' && pathname === '/api/health') {
      response = await handleHealth(env);
    } else if (request.method === 'POST' && pathname === '/api/admin/login') {
      response = await handleAdminLogin(request, env);
    } else if (request.method === 'GET' && pathname === '/api/admin/stats') {
      response = await handleAdminStats(request, env);
    } else if (request.method === 'GET' && pathname === '/api/admin/submissions') {
      response = await handleAdminSubmissions(request, env);
    } else if (request.method === 'POST' && pathname.startsWith('/api/admin/submissions/') && pathname.endsWith('/status')) {
      const parts = pathname.split('/');
      const submissionId = parts[4];
      response = await handleAdminStatusUpdate(request, env, submissionId);
    } else if (request.method === 'GET' && pathname.startsWith('/api/admin/submissions/')) {
      const parts = pathname.split('/');
      const submissionId = parts[4];
      response = await handleAdminSubmissionDetail(request, env, submissionId);
    } else if (request.method === 'GET' && pathname === '/admin') {
      response = await handleAdminPage(request, env);
    } else {
      response = new Response('Not found', { status: 404 });
    }

    return withCors(response, origin);
  },
};
