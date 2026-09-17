// ============================================================================
// RoastMyDorm analytics loader + conversion event hooks
// ============================================================================
// Loads GA4 ONLY when a real Measurement ID is configured in
// js/analytics-config.js. With no ID set, every function in this file is a
// safe no-op: nothing is loaded, nothing is sent, nothing is collected.
//
// Usage from any page (after including analytics-config.js then this file):
//   RMD.trackSearchSubmitted({ city, query })
//   RMD.trackListingViewed({ listingId, city, propertyType })
//   RMD.trackWhatsAppClicked({ listingId })
//   RMD.trackPhoneClicked({ listingId })
//   RMD.trackOwnerContacted({ listingId, method })   // method: 'form'|'whatsapp'|'phone'
//   RMD.trackRegistrationCompleted({ method })        // method: 'google'|'email'
//   RMD.trackPropertySubmitted({ city, propertyType })
//
// Every event payload here is intentionally limited to non-identifying
// context (a listing id, a city, a property type, a UI label) - never a
// name, email, phone number, or free-text field a user typed. Do not add
// PII to any call site; if a call site needs to pass a new field, check it
// against that rule first.
// ============================================================================
(function () {
  var config = (window.RMD_ANALYTICS_CONFIG || {});
  var GA4_ID = config.GA4_MEASUREMENT_ID;
  var sentOnce = {}; // de-dupe guard: same eventName+dedupeKey won't fire twice per page load

  function loadGA4() {
    if (!GA4_ID || window.__rmdGaLoaded) return;
    window.__rmdGaLoaded = true;

    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID);
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    // anonymize_ip is on by default in GA4, but set explicitly for clarity;
    // allow_google_signals off to avoid any cross-device personal profiling.
    window.gtag('config', GA4_ID, { anonymize_ip: true, allow_google_signals: false });
  }

  function send(eventName, params, dedupeKey) {
    if (!GA4_ID) return; // no-op until a real ID is configured
    var key = eventName + ':' + (dedupeKey || '');
    if (dedupeKey && sentOnce[key]) return;
    if (dedupeKey) sentOnce[key] = true;

    if (!window.__rmdGaLoaded) loadGA4();
    if (window.gtag) window.gtag('event', eventName, params || {});
  }

  window.RMD = window.RMD || {};

  window.RMD.trackSearchSubmitted = function (p) {
    send('search_submitted', { city: p && p.city, query_length: p && p.query ? String(p.query).length : undefined });
  };
  window.RMD.trackListingViewed = function (p) {
    send('listing_viewed', { listing_id: p && p.listingId, city: p && p.city, property_type: p && p.propertyType }, 'listing_' + (p && p.listingId));
  };
  window.RMD.trackWhatsAppClicked = function (p) {
    send('whatsapp_clicked', { listing_id: p && p.listingId });
  };
  window.RMD.trackPhoneClicked = function (p) {
    send('phone_clicked', { listing_id: p && p.listingId });
  };
  window.RMD.trackOwnerContacted = function (p) {
    send('owner_contacted', { listing_id: p && p.listingId, method: p && p.method });
  };
  window.RMD.trackRegistrationCompleted = function (p) {
    send('registration_completed', { method: p && p.method });
  };
  window.RMD.trackPropertySubmitted = function (p) {
    send('property_submitted', { city: p && p.city, property_type: p && p.propertyType });
  };

  // Fire the standard GA4 page_view once, only if configured.
  if (GA4_ID) loadGA4();

  // Delegated listeners so WhatsApp/phone conversion clicks are tracked
  // automatically across every page, without needing to hand-wire an
  // onclick into each of the ~150 individual listing pages. Reads only the
  // href already on the link (a phone number or listing filename derived
  // from the current URL) - never anything a user typed.
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href') || '';
    var listingId = (window.location.pathname.split('/').pop() || '').replace(/\.html$/, '');
    if (/wa\.me\//.test(href)) {
      window.RMD.trackWhatsAppClicked({ listingId: listingId });
    } else if (/^tel:/.test(href)) {
      window.RMD.trackPhoneClicked({ listingId: listingId });
    }
  }, { passive: true });
})();

// ============================================================================
// First-party tracking - POST /api/analytics/track
// ============================================================================
// Separate from the GA4 block above (and never gated on GA4_MEASUREMENT_ID
// being set) - this is what actually feeds the admin dashboard's own
// Analytics page (Page Views / Unique Visitors / etc.), which reads from
// this site's own database, not from Google. GA4 data and this data are
// two independent pipelines; neither depends on the other being configured.
//
// Root cause this fixes: POST /api/analytics/track existed on the backend
// but was a dead stub that only console.log'd, AND nothing on the frontend
// ever called it - so the admin Analytics page's Page Views/Unique
// Visitors always read zero real events, not because of a broken query.
(function () {
  if (window.__RMD_TRACKER_INIT__) return; // guards this script running twice on one page
  window.__RMD_TRACKER_INIT__ = true;

  var API_BASE = (function () {
    var h = window.location.hostname;
    return (h === 'localhost' || h === '127.0.0.1' || h === '')
      ? 'http://localhost:5000/api' : 'https://www.roastmydorm.com/api';
  })();

  var VISITOR_KEY = 'rmd_visitor_id';       // localStorage - stable across sessions
  var SESSION_KEY = 'rmd_session_id';       // sessionStorage/rolling - rotates after inactivity
  var SESSION_TS_KEY = 'rmd_session_last_active';
  var SESSION_TIMEOUT_MS = 30 * 60 * 1000;  // 30 minutes, per spec

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    // Fallback for older browsers - not cryptographically strong, but this
    // is an anonymous analytics id, not a security token.
    return 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/x/g, function () {
      return ((Math.random() * 16) | 0).toString(16);
    });
  }

  function getVisitorId() {
    try {
      var id = localStorage.getItem(VISITOR_KEY);
      if (!id) {
        id = uuid();
        localStorage.setItem(VISITOR_KEY, id);
      }
      return id;
    } catch (e) { return null; } // private-mode/storage-blocked - degrade to no id, never throw
  }

  // Persisted in localStorage (not sessionStorage) so the 30-minute
  // inactivity timeout is measured across tabs/tab-closes too, not reset
  // just by opening a new tab.
  function getSessionId() {
    try {
      var now = Date.now();
      var last = parseInt(localStorage.getItem(SESSION_TS_KEY) || '0', 10);
      var id = localStorage.getItem(SESSION_KEY);
      if (!id || !last || (now - last) > SESSION_TIMEOUT_MS) {
        id = uuid();
        localStorage.setItem(SESSION_KEY, id);
      }
      localStorage.setItem(SESSION_TS_KEY, String(now));
      return id;
    } catch (e) { return null; }
  }

  function referrerDomain() {
    try {
      if (!document.referrer) return null;
      return new URL(document.referrer).hostname || null;
    } catch (e) { return null; }
  }

  function currentListingId() {
    // Best-effort only: a page opts in by setting this meta tag (see
    // property-detail.html) or the global before this script runs. Most
    // of the ~150 static listing pages don't set either yet, so listingId
    // is simply omitted for those - "when applicable", per spec.
    if (window.__RMD_CURRENT_LISTING_ID__) return window.__RMD_CURRENT_LISTING_ID__;
    var meta = document.querySelector('meta[name="rmd-listing-id"]');
    return (meta && meta.content) || null;
  }

  function authHeaders() {
    // Reuses RMD_AUTH (frontend/js/rmd-shared.js) when it's loaded on this
    // page - never a new/private token check. Pages that don't include
    // rmd-shared.js simply track anonymously, which is correct for them.
    try {
      if (window.RMD_AUTH && typeof window.RMD_AUTH.getAccessToken === 'function') {
        var t = window.RMD_AUTH.getAccessToken();
        if (t) return { Authorization: 'Bearer ' + t };
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function track(eventName, extra) {
    try {
      // Admin-dashboard pages never load this script in the first place,
      // but this is a second, explicit guard in case that ever changes.
      if (/^\/admin/.test(window.location.pathname)) return;

      var visitorId = getVisitorId();
      var sessionId = getSessionId();
      if (!visitorId || !sessionId) return; // storage unavailable - nothing reliable to send

      var payload = {
        event: eventName,
        pathname: window.location.pathname, // query string/fragment deliberately never included
        pageTitle: (document.title || '').slice(0, 200),
        referrerDomain: referrerDomain(),
        visitorId: visitorId,
        sessionId: sessionId,
      };
      var listingId = currentListingId();
      if (listingId) payload.listingId = listingId;
      if (extra) {
        for (var k in extra) { if (extra[k] !== undefined && extra[k] !== null) payload[k] = extra[k]; }
      }

      var body = JSON.stringify(payload);
      var url = API_BASE + '/analytics/track';
      var headers = authHeaders();

      // sendBeacon can't attach custom headers, so it's only used for the
      // common anonymous case; an authenticated event needs fetch+keepalive
      // instead so the Authorization header actually reaches the server.
      if (!headers && navigator.sendBeacon) {
        var ok = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
        if (ok) return;
        // sendBeacon can return false (queue full/disabled) - fall through to fetch.
      }
      var fetchHeaders = { 'Content-Type': 'application/json' };
      if (headers) { for (var hk in headers) fetchHeaders[hk] = headers[hk]; }
      fetch(url, { method: 'POST', headers: fetchHeaders, body: body, keepalive: true })
        .catch(function () { /* never surface a tracking failure to the user */ });
    } catch (e) { /* analytics must never break the page */ }
  }

  var lastTrackedPath = null;
  function trackPageView() {
    // Covers both "this exact page loaded twice" (double include) and
    // "pushState fired for a URL that didn't actually change" - a real
    // navigation to a NEW path always tracks again.
    if (lastTrackedPath === window.location.pathname) return;
    lastTrackedPath = window.location.pathname;
    track('page_view');
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    trackPageView();
  } else {
    document.addEventListener('DOMContentLoaded', trackPageView);
  }

  // Client-side navigation (history.pushState) - tracked the same way a
  // full page load is, so an SPA-style section of the site isn't invisible
  // to Page Views.
  var originalPushState = history.pushState;
  history.pushState = function () {
    var result = originalPushState.apply(this, arguments);
    trackPageView();
    return result;
  };
  window.addEventListener('popstate', trackPageView);

  // Exposed so other code (e.g. a search form, the DormInquiry contact
  // flow, a signup/login handler) can send one of the other whitelisted
  // event types without reimplementing any of the above. Not yet wired
  // into every relevant call site - see the analytics task's remaining
  // limitations.
  window.RMD.trackFirstParty = track;
})();
