/**
 * The Tank Guide signed Cloudinary upload authorization service.
 *
 * This entry point deliberately imports Cloudflare's DurableObject base class.
 * The SQLite-backed session class is declared in wrangler.jsonc; image bytes
 * continue directly from the browser to Cloudinary and never reach this Worker.
 */
import { DurableObject } from 'cloudflare:workers';

import { createUploadSessionClass, handleRequest } from './worker-core.js';

export * from './worker-core.js';

export const UploadSession = createUploadSessionClass(DurableObject);

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  }
};
