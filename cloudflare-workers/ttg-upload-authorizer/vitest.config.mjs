import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

const testSecrets = {
  CLOUDINARY_API_KEY: 'test-api-key',
  CLOUDINARY_API_SECRET: 'test-api-secret',
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
