/**
 * Shared escaping/serialization helpers for server-rendered SEO metadata
 * (see routes/dormSeo.js and utils/sitemapGenerator.js). Each context -
 * HTML text/attribute, XML, JSON embedded in a <script> tag - has its own
 * escaping rules; using the wrong one (or raw string concatenation) is
 * exactly how untrusted listing text (title/description, which admins
 * control and could contain `"><script>...`) turns into stored XSS. Never
 * interpolate a value into HTML/XML/JSON without going through one of
 * these first.
 */

// HTML text content AND attribute values share the same 5-entity escape -
// safe for both `<title>{here}</title>` and `content="{here}"`.
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .split('&').join('&amp;')
    .split('<').join('&lt;')
    .split('>').join('&gt;')
    .split('"').join('&quot;')
    .split("'").join('&#39;');
}

// XML has the same 5 predefined entities as HTML - one implementation
// covers both `<title>`/`<meta>` injection and sitemap.xml <loc>/<lastmod>.
var escapeXml = escapeHtml;

var LT_SEQUENCE = String.fromCharCode(0x3c); // '<'
var LINE_SEPARATOR = String.fromCharCode(0x2028);
var PARA_SEPARATOR = String.fromCharCode(0x2029);

// Safely embeds a JSON-LD object inside `<script type="application/ld+json">`.
// JSON.stringify already correctly escapes quotes/backslashes/control
// chars inside string values; the two things it does NOT protect against
// are (a) a literal `</script` substring breaking out of the script
// element regardless of which JSON string it's inside, and (b) U+2028/
// U+2029 (line/paragraph separator), which are valid in JSON strings but
// illegal unescaped in a JS string literal - irrelevant for a real
// application/ld+json block specifically, but escaped anyway since this
// helper doubles as "safe to embed in a <script> tag" more generally.
function safeJsonLd(data) {
  var json = JSON.stringify(data);
  json = json.split(LT_SEQUENCE).join('\\u003c');
  json = json.split(LINE_SEPARATOR).join('\\u2028');
  json = json.split(PARA_SEPARATOR).join('\\u2029');
  return json;
}

// Validates a string is a well-formed absolute http(s) URL before it's
// ever used as an og:image/twitter:image/canonical value - a malformed or
// non-http(s) value (e.g. a relative path with no leading slash, or a
// `javascript:` URL if a field were ever misused) must never be emitted.
function isValidAbsoluteHttpUrl(value) {
  if (typeof value !== 'string' || !value) return false;
  try {
    var u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

module.exports = { escapeHtml: escapeHtml, escapeXml: escapeXml, safeJsonLd: safeJsonLd, isValidAbsoluteHttpUrl: isValidAbsoluteHttpUrl };
