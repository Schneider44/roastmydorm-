/**
 * RoastMyDorm — Google One Tap Authentication
 * Include this script on any page that needs Google sign-in.
 *
 * Usage:
 *   <script src="/js/google-auth.js"></script>
 *   GoogleAuth.init({ onSuccess: (user) => { ... } });
 */

const GoogleAuth = (() => {
  const API_BASE = (() => {
    const h = window.location.hostname;
    return (h === 'localhost' || h === '127.0.0.1' || h === '')
      ? 'http://localhost:5000/api'
      : 'https://www.roastmydorm.com/api';
  })();

  const SESSION_KEY = 'rmd_session';

  // ── Token storage ────────────────────────────────────────────
  function saveSession(data) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  }

  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; }
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function isLoggedIn() {
    const s = getSession();
    return !!(s && s.accessToken && s.user);
  }

  function getUser() {
    return getSession()?.user || null;
  }

  function getAccessToken() {
    return getSession()?.accessToken || null;
  }

  // ── Send Google credential to backend ───────────────────────
  async function handleCredentialResponse(response, callbacks) {
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Sign-in failed');
      }

      saveSession({
        user: data.data.user,
        accessToken: data.data.accessToken,
        refreshToken: data.data.refreshToken
      });

      if (typeof callbacks.onSuccess === 'function') {
        callbacks.onSuccess(data.data.user);
      }

    } catch (err) {
      console.error('[GoogleAuth] Sign-in error:', err.message);
      if (typeof callbacks.onError === 'function') {
        callbacks.onError(err.message);
      }
    }
  }

  // ── Initialize Google One Tap ────────────────────────────────
  function init({ clientId, onSuccess, onError, autoSelect = true, cancelOnTapOutside = false } = {}) {
    const id = clientId || window.GOOGLE_CLIENT_ID;
    if (!id) {
      console.error('[GoogleAuth] GOOGLE_CLIENT_ID is not set. Call GoogleAuth.init({ clientId: "..." })');
      return;
    }

    // If already logged in, fire onSuccess immediately with stored user
    if (isLoggedIn()) {
      if (typeof onSuccess === 'function') onSuccess(getUser());
      return;
    }

    const callbacks = { onSuccess, onError };

    window.handleGoogleOneTap = (response) => handleCredentialResponse(response, callbacks);

    // Load the Google Identity Services SDK
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      google.accounts.id.initialize({
        client_id: id,
        callback: (response) => handleCredentialResponse(response, callbacks),
        auto_select: autoSelect,
        cancel_on_tap_outside: cancelOnTapOutside,
        ux_mode: 'popup'
      });

      // Show One Tap prompt
      google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed()) {
          console.info('[GoogleAuth] One Tap not displayed:', notification.getNotDisplayedReason());
        }
        if (notification.isSkippedMoment()) {
          console.info('[GoogleAuth] One Tap skipped:', notification.getSkippedReason());
        }
      });

      // Render the Sign In With Google button if a container exists
      const btnContainer = document.getElementById('google-signin-btn');
      if (btnContainer) {
        google.accounts.id.renderButton(btnContainer, {
          type: 'standard',
          shape: 'rectangular',
          theme: 'outline',
          text: 'signin_with',
          size: 'large',
          logo_alignment: 'left',
          width: btnContainer.offsetWidth || 300
        });
      }
    };

    document.head.appendChild(script);
  }

  // ── Sign out ─────────────────────────────────────────────────
  async function signOut(redirectUrl = null) {
    const session = getSession();

    // Revoke Google session
    if (window.google?.accounts?.id) {
      google.accounts.id.disableAutoSelect();
    }

    // Revoke backend session
    if (session?.accessToken) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.accessToken}`
          },
          body: JSON.stringify({ refreshToken: session.refreshToken })
        });
      } catch (_) {}
    }

    clearSession();

    if (redirectUrl) window.location.href = redirectUrl;
  }

  // ── Refresh access token ─────────────────────────────────────
  async function refreshToken() {
    const session = getSession();
    if (!session?.refreshToken) return null;

    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken })
      });
      const data = await res.json();
      if (data.success) {
        saveSession({ ...session, accessToken: data.data.accessToken });
        return data.data.accessToken;
      }
    } catch (_) {}

    clearSession();
    return null;
  }

  // ── Authenticated fetch helper ───────────────────────────────
  async function authFetch(url, options = {}) {
    let token = getAccessToken();
    if (!token) throw new Error('Not authenticated');

    const doRequest = (t) => fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' }
    });

    let res = await doRequest(token);

    // If 401, try refreshing token once
    if (res.status === 401) {
      token = await refreshToken();
      if (!token) throw new Error('Session expired. Please sign in again.');
      res = await doRequest(token);
    }

    return res;
  }

  return { init, signOut, isLoggedIn, getUser, getAccessToken, authFetch, clearSession };
})();
