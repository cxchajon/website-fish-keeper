import { createServer } from 'http';
import { promises as fs } from 'fs';
import { extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = resolve(__dirname, '..');
const port = Number(process.env.PORT) || 4173;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function resolvePath(urlPath) {
  let normalized = decodeURIComponent(urlPath.split('?')[0] || '/');
  if (normalized === '/' || normalized.endsWith('/')) {
    normalized = join(normalized, 'index.html');
  }
  const filePath = resolve(root, `.${normalized}`);
  if (!filePath.startsWith(root)) {
    return null;
  }
  return filePath;
}

const server = createServer(async (req, res) => {
  const filePath = resolvePath(req.url || '/');
  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  try {
    const data = await fs.readFile(filePath);
    const type = MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error');
    }
  }
});

const closeServer = () => {
  server.close(() => process.exit(0));
};

process.on('SIGINT', closeServer);
process.on('SIGTERM', closeServer);

server.listen(port, () => {
  console.log(`Static server running at http://localhost:${port}`);
});
