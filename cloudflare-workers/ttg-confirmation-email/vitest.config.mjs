import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

const testSecrets = {
  CONFIRM_DEDUP_KEY: 'test-confirm-dedup-key-0123456789abcdef',
  RESEND_API_KEY: 'test-resend-key',
  TURNSTILE_SECRET_KEY: 'test-turnstile-secret'
};

for (const [name, value] of Object.entries(testSecrets)) {
  process.env[name] ??= value;
}

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          ...testSecrets
        }
      }
    })
  ],
  test: {
    include: ['test/runtime/**/*.test.mjs']
  }
});
