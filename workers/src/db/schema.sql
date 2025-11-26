-- D1 Database schema for feature-tank-db

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  user_name TEXT,
  user_email TEXT,
  youtube TEXT,
  instagram TEXT,
  tiktok TEXT,
  tank_name TEXT,
  tank_size INTEGER,
  environment TEXT CHECK (environment IN ('planted', 'unplanted')),
  photos TEXT,
  text_source TEXT CHECK (text_source IN ('user', 'fklc')),
  text_content TEXT,
  editing_package_purchased INTEGER,
  extra_photos_purchased INTEGER,
  is_first_tank INTEGER,
  base_price REAL,
  total_price REAL,
  payment_status TEXT CHECK (payment_status IN ('free', 'pending', 'paid', 'refunded')),
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  total_credits_purchased INTEGER,
  credits_used INTEGER,
  status TEXT CHECK (
    status IN (
      'submitted',
      'payment_pending',
      'in_review',
      'awaiting_first_draft',
      'draft_ready',
      'awaiting_user_approval',
      'published',
      'rejected'
    )
  ),
  revisions TEXT,
  published_at TEXT,
  published_url TEXT,
  duplicate_check_score REAL,
  flagged_as_duplicate INTEGER,
  admin_notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_submissions_user_email ON submissions(user_email);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);

CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  name TEXT,
  total_submissions INTEGER DEFAULT 0,
  first_tank_discount_used INTEGER DEFAULT 0,
  newsletter_subscribed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_submission TEXT
);

CREATE TABLE IF NOT EXISTS credit_purchases (
  id TEXT PRIMARY KEY,
  submission_id TEXT,
  user_email TEXT,
  purchase_date TEXT,
  credits_added INTEGER,
  amount REAL,
  stripe_payment_intent_id TEXT,
  reason TEXT CHECK (reason IN ('initial', 'additional_during_review', 'future_update')),
  status TEXT CHECK (status IN ('active', 'refunded'))
);
