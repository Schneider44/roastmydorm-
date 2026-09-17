/**
 * Single source of truth for the site's public static root - the ONE
 * physical directory Apache/LiteSpeed serves for every request that isn't
 * intercepted by an Express route (including the literal file it serves
 * for GET /sitemap.xml, ahead of Express's own routing - see server.js's
 * static-file-precedence note).
 *
 * Before this module existed, three separate files independently
 * recomputed the same path with `path.join(__dirname, ..., 'public_html')`
 * (server.js's own static middleware, routes/admin/sitemap.js, routes/
 * admin/dorms.js's auto-regeneration hook) - exactly the kind of
 * multiple-copies-of-the-same-fact drift the sitemap-generator
 * consolidation already fixed elsewhere. A sitemap generator that resolves
 * this path even slightly differently than server.js's static middleware
 * would silently write a file nothing ever serves.
 *
 * Resolution order (first match wins):
 *   1. FRONTEND_STATIC_PATH env var - explicit override. Always wins, even
 *      if it points somewhere that doesn't (yet) exist, so tests can point
 *      it at a throwaway temp directory.
 *   2. <repo root>/public_html - the Hostinger/Passenger production
 *      layout: this repo's backend/ and public_html/ are siblings on the
 *      server, and Apache/LiteSpeed serves straight out of public_html/
 *      before Express ever runs (confirmed by SSH: the deployed server.js
 *      is byte-identical to local, yet live /sitemap.xml and /robots.txt
 *      differ from what the app's own dynamic routes would produce -
 *      those routes are dead code, outrun by static-file precedence).
 *   3. <repo root>/frontend - the local git checkout layout. public_html/
 *      does not exist in a fresh clone; only frontend/ does.
 * Throws with a clear message if neither directory exists and no override
 * was given - silently resolving to a directory that doesn't exist would
 * make express.static() serve nothing and the sitemap writer fail with a
 * confusing ENOENT, rather than a message that says what's actually wrong.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');

function resolveStaticRoot() {
  if (process.env.FRONTEND_STATIC_PATH) return process.env.FRONTEND_STATIC_PATH;

  const publicHtml = path.join(REPO_ROOT, 'public_html');
  if (fs.existsSync(publicHtml)) return publicHtml;

  const frontend = path.join(REPO_ROOT, 'frontend');
  if (fs.existsSync(frontend)) return frontend;

  throw new Error(
    'Cannot resolve the site static root: neither "' + publicHtml + '" nor "' + frontend +
    '" exists, and FRONTEND_STATIC_PATH is not set. Set FRONTEND_STATIC_PATH explicitly ' +
    'if the static files live somewhere else.'
  );
}

module.exports = { resolveStaticRoot, REPO_ROOT };
