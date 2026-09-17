/**
 * Server-visible SEO metadata for /logement/:slug (a real Dorm listing).
 *
 * Root cause this fixes: property-detail.html is a single static file
 * (res.sendFile, no server templating) reused for every listing - its
 * <head> always shipped the same generic title/description/canonical
 * regardless of which slug was requested (proven: curl of a real live
 * listing returned `<link rel="canonical" href=".../property-detail.html">`,
 * not the listing's own URL). property-detail.js's client-side updateSEO()
 * already corrects this AFTER the dorm data loads, but that's invisible to
 * any tool that doesn't execute JS - a non-JS crawler, most link-preview
 * unfurlers (WhatsApp/Facebook/Twitter), and the very first HTML Google
 * fetches before its render queue runs.
 *
 * This module injects the real per-listing tags into the HTML BEFORE it's
 * sent, using the same title/description-building algorithm as
 * property-detail.js's updateSEO() (see the comment above
 * buildDescription() below) so server and client never disagree once JS
 * does run and overwrites the same tags with the same values.
 */
const fs = require('fs');
const path = require('path');
const { escapeHtml, safeJsonLd, isValidAbsoluteHttpUrl } = require('../utils/htmlEscape');
const { verifyPreviewToken } = require('../utils/previewToken');

const BASE_URL = 'https://www.roastmydorm.com';
const SITE_NAME = 'RoastMyDorm';
const DEFAULT_IMAGE = BASE_URL + '/roastmydorm_logo-removebg-preview.png';

// Old-slug -> canonical-slug 301 redirects only ever carry forward this
// explicit whitelist of standard marketing-attribution params - never the
// full incoming query string. The request that hits this redirect could
// carry ANYTHING in its query string: a ?preview=<jwt> token meant for a
// draft preview flow, an app-specific auth/session token some other part
// of the site might put in a URL, an email address, or any other
// unvetted value a link generator (or an attacker crafting a link) chose
// to attach. Blindly reflecting all of that into a Location header leaks
// it into browser history, the Referer header of whatever the redirected
// page loads next, and any access/proxy logs along the way - a classic
// "quiet exfiltration via redirect" pattern, not something a URL
// shortener-style redirect should ever do by default. Standard UTM
// parameters are the one category genuinely useful to preserve (campaign
// attribution surviving a slug rename) and have no confidentiality value.
const REDIRECT_QUERY_WHITELIST = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

function buildSafeRedirectQueryString(query) {
  const params = new URLSearchParams();
  for (const key of REDIRECT_QUERY_WHITELIST) {
    if (typeof query[key] === 'string' && query[key]) {
      params.set(key, query[key]);
    }
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

const PROPERTY_TYPE_LABELS = {
  dormitory: 'Résidence étudiante',
  apartment: 'Appartement',
  studio: 'Studio',
  shared_room: 'Chambre partagée',
  private_room: 'Chambre privée',
};

function capitalize(s) {
  return s && typeof s === 'string' ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function absoluteImageUrl(value) {
  if (!value || typeof value !== 'string') return null;
  if (/^https?:\/\//i.test(value)) return value;
  return BASE_URL + (value.charAt(0) === '/' ? '' : '/') + value;
}

// Mirrors frontend/js/property-detail.js's updateSEO() description-building
// logic exactly (same field precedence, same 155-char cap, same fallback
// string) - this is the "prevent metadata disagreement" requirement: once
// the client-side JS runs and calls the identical algorithm against the
// identical Dorm fields, it produces the identical string, so the tag
// never visibly changes/flickers and never disagrees with what a crawler
// already read.
function buildDescription(dorm) {
  const city = dorm.location && dorm.location.address && dorm.location.address.city;
  const neighborhood = dorm.location && dorm.location.address && dorm.location.address.neighborhood;
  const placeBits = [neighborhood, city ? capitalize(city) : null].filter(Boolean);
  const typeLabel = PROPERTY_TYPE_LABELS[dorm.propertyType] || null;
  const price = dorm.pricing && typeof dorm.pricing.baseRent === 'number' ? dorm.pricing.baseRent : null;
  // Mirrors vm.currency in property-detail.js exactly (pricing.currency
  // defaults to 'MAD' in the schema, but is an editable, unrestricted
  // string field - not hardcoding this was a real client/server
  // disagreement risk for any listing an admin ever sets a different
  // currency on).
  const currency = (dorm.pricing && dorm.pricing.currency) || 'MAD';

  const bits = [];
  if (dorm.description) {
    bits.push(String(dorm.description).replace(/\s+/g, ' ').trim());
  } else {
    if (typeLabel) bits.push(typeLabel);
    if (placeBits.length) bits.push('à ' + placeBits.join(', '));
    if (price !== null) bits.push('— ' + price.toLocaleString('fr-FR') + ' ' + currency + ' / mois');
  }
  const description = bits.join(' ').slice(0, 155);
  return description || 'Logement étudiant vérifié sur RoastMyDorm.';
}

/**
 * Builds the full set of metadata for one Dorm document. `canonicalUrl`
 * must already be the listing's REAL canonical URL (built from
 * `dorm.slug`, never the requested/possibly-old slug - see
 * server.js's caller, which resolves this before calling in here).
 */
function buildDormMeta(dorm, canonicalUrl, { noindex }) {
  const title = dorm.name ? String(dorm.name).trim() : 'Logement étudiant';
  const description = buildDescription(dorm);

  const images = Array.isArray(dorm.images) ? dorm.images : [];
  const primary = images.find((i) => i && i.isPrimary) || images[0] || null;
  const rawImageUrl = primary ? absoluteImageUrl(primary.url) : null;
  const ogImage = rawImageUrl && isValidAbsoluteHttpUrl(rawImageUrl) ? rawImageUrl : DEFAULT_IMAGE;

  const city = dorm.location && dorm.location.address && dorm.location.address.city;
  const neighborhood = dorm.location && dorm.location.address && dorm.location.address.neighborhood;
  const price = dorm.pricing && typeof dorm.pricing.baseRent === 'number' ? dorm.pricing.baseRent : null;

  let jsonLd = null;
  if (city || neighborhood || price !== null) {
    const accommodation = {
      '@context': 'https://schema.org',
      '@type': 'Accommodation',
      name: title,
      url: canonicalUrl,
    };
    if (dorm.description) accommodation.description = String(dorm.description);
    const validImages = images
      .map((i) => absoluteImageUrl(i && i.url))
      .filter(isValidAbsoluteHttpUrl);
    if (validImages.length) accommodation.image = validImages;
    if (city || neighborhood) {
      accommodation.address = { '@type': 'PostalAddress', addressCountry: 'MA' };
      if (city) accommodation.address.addressLocality = capitalize(city);
      if (neighborhood) accommodation.address.addressRegion = neighborhood;
    }
    if (price !== null) {
      accommodation.offers = {
        '@type': 'Offer',
        price,
        priceCurrency: (dorm.pricing && dorm.pricing.currency) || 'MAD',
        availability: (dorm.availability && dorm.availability.isAvailable === false)
          ? 'https://schema.org/OutOfStock'
          : 'https://schema.org/InStock',
        url: canonicalUrl,
      };
    }
    jsonLd = accommodation;
  }

  return {
    title,
    fullTitle: `${title} | ${SITE_NAME}`,
    description,
    canonicalUrl,
    ogImage,
    robots: noindex ? 'noindex, nofollow' : 'index, follow',
    jsonLd,
  };
}

// The exact static block this replaces - see frontend/property-detail.html's
// <head>. Matched as one literal block (not several independent regexes)
// so a partial/ambiguous match can never silently corrupt the template;
// if this string isn't found verbatim, injectMeta() falls back to serving
// the unmodified template rather than guessing.
const STATIC_HEAD_BLOCK = `    <title>Logement étudiant - RoastMyDorm</title>
    <meta name="description" content="Découvre ce logement étudiant vérifié sur RoastMyDorm : photos, prix, équipements et contact direct avec l'annonceur.">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="https://www.roastmydorm.com/property-detail.html">

    <meta property="og:type" content="website">
    <meta property="og:site_name" content="RoastMyDorm">
    <meta name="twitter:card" content="summary_large_image">`;

/**
 * Injects real metadata into the template HTML. Every value that came
 * from the database (title, description, image URL) goes through
 * escapeHtml() before landing inside an attribute or text node - never
 * raw string concatenation. The JSON-LD block goes through safeJsonLd()
 * instead, which has its own escaping rules for that context.
 *
 * Returns the original template unchanged if the expected static block
 * isn't found (e.g. the template was edited and this function needs
 * updating) - serving the generic-but-valid page is strictly safer than
 * guessing at a different injection point.
 */
function injectMeta(templateHtml, meta) {
  if (!templateHtml.includes(STATIC_HEAD_BLOCK)) {
    return templateHtml;
  }

  // Real bug found and fixed by the browser-based raw-vs-post-JS parity
  // check: <title> must carry the "| RoastMyDorm" suffix (fullTitle), but
  // og:title/twitter:title must NOT - property-detail.js's updateSEO()
  // passes updateMetaTags({title: vm.title, ...}) (the bare dorm name),
  // which sets document.title to `${title} | ${siteName}` internally but
  // sets og:title/twitter:title to the bare `title` param directly (see
  // frontend/js/seo-utils.js's updateOrCreateMeta calls). Using fullTitle
  // for all three tags here made og:title/twitter:title visibly change
  // the instant client JS ran - caught only by comparing raw HTML against
  // the post-JS DOM in a real browser, not by code inspection alone.
  const pageTitle = escapeHtml(meta.fullTitle);
  const socialTitle = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const canonical = escapeHtml(meta.canonicalUrl);
  const image = escapeHtml(meta.ogImage);
  const robots = escapeHtml(meta.robots);

  const replacement = `    <title>${pageTitle}</title>
    <meta name="description" content="${description}">
    <meta name="robots" content="${robots}">
    <link rel="canonical" href="${canonical}">

    <meta property="og:type" content="article">
    <meta property="og:site_name" content="RoastMyDorm">
    <meta property="og:title" content="${socialTitle}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:image" content="${image}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${socialTitle}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${image}">${meta.jsonLd ? `
    <script type="application/ld+json">${safeJsonLd(meta.jsonLd)}</script>` : ''}`;

  return templateHtml.replace(STATIC_HEAD_BLOCK, replacement);
}

let templateCache = null;
// Reads the template file once per process and reuses it for every
// request - a fresh deploy restarts the Node/Passenger process (this
// app's normal deploy flow touches tmp/restart.txt for exactly this
// reason), which clears this cache along with everything else. Injection
// itself is still done fresh per-request from this cached copy, so one
// listing's tags are never reused for another (see injectMeta() - it
// returns a new string each call, the cache only holds the unmodified
// template).
function getTemplate(frontendPath) {
  if (templateCache === null) {
    templateCache = fs.readFileSync(path.join(frontendPath, 'property-detail.html'), 'utf8');
  }
  return templateCache;
}

// Test-only escape hatch - Jest runs against a fixture template, not the
// real file, and needs to reset the module-level cache between cases.
function _resetTemplateCacheForTests() {
  templateCache = null;
}

/**
 * Express handler factory for GET /logement/:slug. `getFrontendPath` is a
 * function, not a value - server.js's frontendPath is a module-level
 * const declared AFTER this route is registered (this handler only ever
 * runs once a real request arrives, long after the whole module has
 * finished loading, so reading it lazily here is safe; capturing it
 * directly at registration time would throw, since it wouldn't exist yet).
 */
function createDormSeoHandler({ DormModel, getFrontendPath }) {
  return async function dormSeoHandler(req, res) {
    const frontendPath = getFrontendPath();
    const requestedSlug = req.params.slug;
    let dorm;
    try {
      // ONE query serves the redirect check, the status/noindex decision,
      // and the metadata - nothing else in this handler queries Mongo again.
      dorm = await DormModel.findOne({ slug: requestedSlug });
      if (!dorm) {
        dorm = await DormModel.findOne({ previousSlugs: requestedSlug });
        if (dorm) {
          // Old slug still resolves to a real listing under its current
          // canonical slug - one 301, not a 200 with the wrong canonical.
          // Only a whitelisted set of UTM attribution params ever survives
          // the redirect - see buildSafeRedirectQueryString()'s comment for
          // why the rest of the incoming query string is deliberately
          // dropped rather than forwarded verbatim.
          return res.redirect(301, `/logement/${encodeURIComponent(dorm.slug)}${buildSafeRedirectQueryString(req.query)}`);
        }
      }
    } catch (err) {
      console.error('[dormSeo] Dorm lookup failed:', err.message);
      return res.status(500).sendFile(path.join(frontendPath, '404.html'));
    }

    if (!dorm) {
      // Unknown/deleted slug - a real 404, never a generic indexable 200.
      res.status(404);
      return res.sendFile(path.join(frontendPath, '404.html'));
    }

    let noindex = false;
    if (dorm.status !== 'published') {
      // Preview access preserves its existing token-based authorization -
      // same check the client-side /api/dorms/slug/:slug route already
      // uses (utils/previewToken.js) - and is always noindex regardless
      // of whether the token is valid, since a draft must never be
      // indexable even when legitimately previewed.
      const previewToken = req.query.preview;
      const validPreview = previewToken ? verifyPreviewToken(previewToken, dorm._id) : null;
      if (!validPreview) {
        res.status(404);
        return res.sendFile(path.join(frontendPath, '404.html'));
      }
      noindex = true;
    }

    const canonicalUrl = `${BASE_URL}/logement/${encodeURIComponent(dorm.slug)}`;
    const meta = buildDormMeta(dorm, canonicalUrl, { noindex });

    // Real bug found and fixed: the fallback re-read of getTemplate()
    // below was itself outside any try/catch - if the template file is
    // ever unreadable (e.g. missing entirely, a packaging error), BOTH
    // the primary call and this "safe" fallback throw the same error,
    // and the second, uncaught throw took down the whole Node process
    // for every route, not just this one. A missing static template is
    // now a 500 for this one request, never a process crash.
    let html;
    try {
      html = injectMeta(getTemplate(frontendPath), meta);
    } catch (err) {
      console.error('[dormSeo] Template injection failed, serving unmodified template:', err.message);
      try {
        html = getTemplate(frontendPath);
      } catch (fallbackErr) {
        console.error('[dormSeo] Template unreadable, cannot serve this listing:', fallbackErr.message);
        return res.status(500).sendFile(path.join(frontendPath, '404.html'), (sendErr) => {
          if (sendErr) res.status(500).type('text/plain').send('Internal server error');
        });
      }
    }

    // Dynamic per-listing content (availability/price can change) - not
    // the blanket 30-day immutable caching express.static gives real
    // static files. no-cache still allows a conditional revalidation,
    // just never serves a stale copy without checking.
    res.set('Cache-Control', 'no-cache, must-revalidate');
    res.set('Content-Type', 'text/html; charset=UTF-8');
    res.send(html);
  };
}

module.exports = {
  createDormSeoHandler,
  buildDormMeta,
  buildDescription,
  injectMeta,
  absoluteImageUrl,
  buildSafeRedirectQueryString,
  REDIRECT_QUERY_WHITELIST,
  STATIC_HEAD_BLOCK,
  _resetTemplateCacheForTests,
};
