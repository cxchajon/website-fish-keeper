export function getEnvConfig(env = {}) {
  return {
    ENVIRONMENT: env.ENVIRONMENT || 'development',
    SITE_URL: env.SITE_URL || 'https://thetankguide.com',
    REQUIRED_SECRETS: [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'RESEND_API_KEY',
      'ADMIN_PASSWORD_HASH',
    ],
  };
}
