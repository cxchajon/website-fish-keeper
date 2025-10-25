const { mkdirSync, existsSync } = require('fs');
const { dirname, resolve } = require('path');

const outDir = resolve(__dirname, 'out');
if (!existsSync(outDir)) {
  mkdirSync(outDir, { recursive: true });
}
