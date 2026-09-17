/**
 * Isolated-deploy note: this file does not exist yet in production. This is
 * a deliberately minimal version - only the pieces the admin-mediated
 * housing-request pages (mes-demandes.html, property-detail.html,
 * housing-request-status.html) actually call: a shared API-base resolver
 * and RMD_AUTH, the single shared session/token resolver used instead of
 * each page hand-rolling its own token-decode/refresh logic. The full
 * shared header/bottom-nav/notification-bell version of this file (built
 * for the Colocataires/roommate section) is intentionally left out of this
 * deploy - it's a separate, still-in-review feature that happens to live in
 * the same filename upstream; none of the three pages above render their
 * own header/nav through this file (each has its own inline header markup),
 * so leaving that part out changes nothing for them.
 *
 * Usage: <script src="js/rmd-shared.js"></script> then
 *   window.RMD_AUTH.getAccessToken() / .authenticatedFetch(url, options)
 */
(function () {
  'use strict';

  function apiBase() {
    return ['localhost', '127.0.0.1', ''].includes(window.location.hostname)
      ? 'http://localhost:5000/api' : 'https://www.roastmydorm.com/api';
  }

  // ── RMD_AUTH: one shared session/profile-status resolver ────────
  // Root-cause fix: find-roommate.html's hero CTA was static markup, the
  // shared header's account button was static too, and find-roommate-
  // matches.js/find-roommate-profile.js each hand-rolled their own private
  // token-decode/401-refresh logic - three independent, already-diverged
  // guesses at "is this user logged in" instead of one. This module is the
  // single source of truth every roommate page and the shared nav consume
  // instead of inspecting storage themselves.
  const RMD_AUTH = (function () {
    const STORAGE = { token: 'rmd_token', refresh: 'rmd_refresh', user: 'rmd_user' };

    let resolvedState = null; // cached for this page's lifetime only - a fresh navigation always re-resolves, so two accounts in one browser never share stale state
    let inFlightResolve = null;
    let inFlightRefresh = null;
    let generation = 0; // bumped by invalidate()/updateProfile() so a slow, now-stale in-flight resolve can never clobber a newer state
    const listeners = new Set();

    function notify() { listeners.forEach((fn) => { try { fn(resolvedState); } catch (e) { /* one bad subscriber must not break the others */ } }); }

    function subscribe(fn) {
      listeners.add(fn);
      if (resolvedState) fn(resolvedState);
      return () => listeners.delete(fn);
    }

    function getAccessToken() { return localStorage.getItem(STORAGE.token); }
    function getRefreshToken() { return localStorage.getItem(STORAGE.refresh); }
    function hasAnySessionData() { return !!(getAccessToken() || getRefreshToken() || localStorage.getItem(STORAGE.user)); }

    function clearSession() {
      localStorage.removeItem(STORAGE.token);
      localStorage.removeItem(STORAGE.refresh);
      localStorage.removeItem(STORAGE.user);
    }

    // Single-flight refresh - resolveSession()'s own expiry retry and
    // authenticatedFetch()'s retry both share this exact promise, so two
    // concurrent 401s can never trigger two refresh calls.
    function doRefresh() {
      if (inFlightRefresh) return inFlightRefresh;
      inFlightRefresh = (async () => {
        const rt = getRefreshToken();
        if (!rt) return null;
        try {
          const res = await fetch(apiBase() + '/auth/refresh', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }),
          });
          const data = await res.json().catch(() => null);
          if (res.ok && data && data.success && data.data && data.data.accessToken) {
            localStorage.setItem(STORAGE.token, data.data.accessToken);
            if (data.data.refreshToken) localStorage.setItem(STORAGE.refresh, data.data.refreshToken);
            return data.data.accessToken;
          }
        } catch (e) { /* network failure during refresh - fall through to null */ }
        return null;
      })();
      return inFlightRefresh.finally(() => { inFlightRefresh = null; });
    }

    // The shared authenticated client every subsequent roommate call
    // (matches, interests, notifications, messages, profile save) uses
    // instead of its own private fetch+refresh block.
    async function authenticatedFetch(url, options) {
      options = options || {};
      const doReq = (token) => {
        const headers = Object.assign({}, options.headers || {}, token ? { Authorization: 'Bearer ' + token } : {});
        if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
        return fetch(url, Object.assign({}, options, { headers }));
      };
      let res = await doReq(getAccessToken());
      if (res.status === 401) {
        const data = await res.clone().json().catch(() => null);
        const code = data && data.code;
        if ((code === 'TOKEN_EXPIRED' || code === 'INVALID_TOKEN') && getRefreshToken()) {
          const newToken = await doRefresh();
          if (newToken) res = await doReq(newToken);
        }
      }
      return res;
    }

    async function doResolve() {
      if (!getAccessToken() && !getRefreshToken() && !localStorage.getItem(STORAGE.user)) {
        return { status: 'ANONYMOUS', user: null, roommateProfile: null, error: null };
      }

      let token = getAccessToken();
      if (!token && getRefreshToken()) {
        token = await doRefresh();
        if (!token) { clearSession(); return { status: 'ANONYMOUS', user: null, roommateProfile: null, error: null }; }
      }

      const fetchProfile = (t) => fetch(apiBase() + '/roommate/profiles/me', { headers: { Authorization: 'Bearer ' + t } });

      try {
        let res = await fetchProfile(token);
        let data = await res.json().catch(() => null);

        if (res.status === 401) {
          const code = data && data.code;
          if (code === 'TOKEN_EXPIRED' || code === 'INVALID_TOKEN') {
            const newToken = await doRefresh();
            if (newToken) {
              res = await fetchProfile(newToken);
              data = await res.json().catch(() => null);
            } else {
              // Refresh failed. A dead/invalid session is not the same as
              // never having had one - AUTH_ERROR, never ANONYMOUS, so the
              // UI can offer "reconnect" instead of implying the user never
              // logged in.
              return { status: 'AUTH_ERROR', user: null, roommateProfile: null, error: null };
            }
          } else {
            // AUTH_REQUIRED. Only genuinely no session data at all is
            // ANONYMOUS - we got this far because SOME session data existed
            // (the check at the top of this function), so the server
            // rejecting a request we believed was authenticated is an
            // anomaly, not a first-time visitor.
            return hasAnySessionData()
              ? { status: 'AUTH_ERROR', user: null, roommateProfile: null, error: null }
              : { status: 'ANONYMOUS', user: null, roommateProfile: null, error: null };
          }
        }

        if (res.status === 200 && data && data.success) {
          return {
            status: data.hasProfile ? 'AUTHENTICATED_WITH_PROFILE' : 'AUTHENTICATED_NO_PROFILE',
            user: data.user || null,
            roommateProfile: data.hasProfile ? data.data : null,
            error: null,
          };
        }
        if (res.status === 404 && data && data.hasProfile === false) {
          return { status: 'AUTHENTICATED_NO_PROFILE', user: data.user || null, roommateProfile: null, error: null };
        }
        if (res.status === 401) {
          // Still 401 after the retry above.
          return { status: 'AUTH_ERROR', user: null, roommateProfile: null, error: null };
        }
        return { status: 'API_ERROR', user: null, roommateProfile: null, error: 'HTTP ' + res.status };
      } catch (e) {
        return { status: 'API_ERROR', user: null, roommateProfile: null, error: e.message };
      }
    }

    function resolveSession() {
      if (resolvedState) return Promise.resolve(resolvedState);
      if (inFlightResolve) return inFlightResolve;
      const myGen = generation;
      inFlightResolve = doResolve().then((result) => {
        inFlightResolve = null;
        if (myGen === generation) { resolvedState = result; notify(); }
        return result;
      });
      return inFlightResolve;
    }

    function invalidate() {
      generation += 1;
      resolvedState = null;
      inFlightResolve = null;
    }

    // Optimistic, no-network transition used right after a successful
    // profile save - the caller is responsible for passing the real,
    // normalized saved-profile object (never a response wrapper).
    function updateProfile(profile) {
      generation += 1;
      resolvedState = {
        status: 'AUTHENTICATED_WITH_PROFILE',
        user: resolvedState ? resolvedState.user : null,
        roommateProfile: profile,
        error: null,
      };
      notify();
    }

    return { resolveSession, invalidate, updateProfile, getAccessToken, authenticatedFetch, subscribe, clearSession };
  })();
  window.RMD_AUTH = RMD_AUTH;

  // RMD_SHARED.toast: the one shared toast used by mes-demandes.js and any
  // other page loading this file. Minimal, dependency-free implementation -
  // matches the visual pattern already used elsewhere on the site (fixed,
  // bottom-of-viewport, auto-dismiss).
  function toast(message, type) {
    let container = document.getElementById('rmdToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'rmdToastContainer';
      container.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    const bg = type === 'error' ? '#dc2626' : type === 'success' ? '#059669' : '#111827';
    el.style.cssText = `background:${bg};color:#fff;padding:10px 16px;border-radius:8px;font-size:14px;font-family:Inter,Arial,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.15);max-width:90vw;`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  window.RMD_SHARED = window.RMD_SHARED || {};
  window.RMD_SHARED.toast = toast;
})();
