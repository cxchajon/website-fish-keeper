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
  params.append('cancel_url', 'https://thetankguide.com/feature-your-tank?cancelled=true');

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

    const photos = formData.getAll('photos').map((photo) => `${photo}`); // Assume Cloudinary URLs or file identifiers

    // Pricing
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
      lineItems.push({ price: 'price_1SXb8SDHdZPeBj86GymEDH1g', quantity: baseAdditionalCount });
      if (extraPhotosAdditional) {
        lineItems.push({ price: 'price_1SXb7wDHdZPeBj86fbJYidJX', quantity: baseAdditionalCount });
      }
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
    await env.DB.prepare('UPDATE submissions SET payment_status = ?, stripe_payment_intent_id = ?, status = ? WHERE id = ?')
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

    // Placeholder for sending confirmation email
    console.log(`Payment completed for submission ${submissionId}`);
  } else if (type === 'checkout.session.expired') {
    await env.DB.prepare('UPDATE submissions SET payment_status = ? WHERE id = ?').bind('pending', submissionId).run();
  } else if (type === 'charge.refunded') {
    const paymentIntent = dataObject.payment_intent;
    await env.DB.prepare('UPDATE submissions SET payment_status = ? WHERE id = ?').bind('refunded', submissionId).run();
    await env.DB.prepare('UPDATE credit_purchases SET status = ? WHERE submission_id = ? OR stripe_payment_intent_id = ?')
      .bind('refunded', submissionId, paymentIntent)
      .run();
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
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
      response = await handleSubmissionCreate(request, env);
    } else if (request.method === 'POST' && url.pathname === '/api/webhooks/stripe') {
      response = await handleStripeWebhook(request, env);
    } else if (request.method === 'GET' && url.pathname === '/api/admin/submissions') {
      response = new Response(JSON.stringify({ message: 'Not implemented yet' }), {
        status: 501,
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      response = new Response('Not found', { status: 404 });
    }

    return withCors(response, origin);
  },
};
