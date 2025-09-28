# End-to-end tests

These Playwright tests expect the static site to be served locally before running. The default configuration will automatically start a temporary server, but you can also run it yourself:

```bash
npm install
node scripts/dev-server.mjs # or: npx http-server . -p 4173
# in another terminal
npx playwright test
# or simply
npm test
```

If you already have the site hosted somewhere else, point the suite at it:

```bash
PLAYWRIGHT_BASE_URL="http://localhost:4173" npx playwright test
```

To reuse an existing server without spawning a new one, set:

```bash
PLAYWRIGHT_SKIP_WEB_SERVER=1 npx playwright test
```
