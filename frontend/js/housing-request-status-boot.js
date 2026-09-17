/**
 * Bootstrap for housing-request-status.html. Kept as an external file
 * (never an inline <script>) because the site's CSP is `script-src 'self'`
 * with no 'unsafe-inline'/nonce - an inline script here is silently
 * blocked by the browser and the page never leaves "Chargement...".
 *
 * Token transport policy: an emailed status-token link carries the token
 * in the URL FRAGMENT (#t=...), never the query string, so it is never
 * sent to the server in an HTTP request (fragments never leave the
 * browser) and never appears in server access logs or the Referer header.
 * This script reads it client-side, immediately scrubs it from the
 * visible URL via history.replaceState(), and forwards it to the API only
 * as a request header (see housing-request-widget.js's
 * fetchStatus/giveConsent).
 */
(function () {
  var params = new URLSearchParams(window.location.search);
  var reference = params.get('ref');
  var fragmentParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  var token = fragmentParams.get('t');

  if (window.location.hash) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  var container = document.getElementById('hrqStatusContainer');
  if (!reference) {
    container.innerHTML = '<div class="hrq-result-icon hrq-result-icon--muted"><i class="fa-solid fa-triangle-exclamation"></i></div><h2 class="hrq-h1">Référence manquante</h2><p class="hrq-lead">Le lien utilisé est incomplet. Vérifie qu\'il correspond bien à l\'e-mail que tu as reçu.</p>';
    return;
  }
  window.RMD_HOUSING_REQUEST.mountStatusPage(container, reference, token);
})();
