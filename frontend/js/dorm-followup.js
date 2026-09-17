/**
 * Standalone landing page opened from a rental-outcome follow-up/reminder
 * email link (?id=<inquiryId>&token=<signed single-purpose token>). Works
 * with EITHER a valid token in the URL OR a normal logged-in session for
 * the inquiry's own student - mirrors the dual-auth accepted by the
 * backend's GET/PATCH .../outcome routes. Never requests, stores, or
 * displays any landlord contact data - the backend response itself never
 * includes it (see routes/dormInquiries.js's GET /followup/:id).
 */
(function () {
  'use strict';

  const API = ['localhost', '127.0.0.1', ''].includes(window.location.hostname)
    ? 'http://localhost:5000/api' : 'https://www.roastmydorm.com/api';

  const params = new URLSearchParams(window.location.search);
  const inquiryId = params.get('id');
  const token = params.get('token');

  const $ = (id) => document.getElementById(id);
  let answered = false;

  function hideAllStates() {
    ['loadingState', 'invalidState', 'errorState'].forEach((id) => {
      const el = $(id); if (el) el.hidden = true;
    });
  }

  function escapeText(str) { const d = document.createElement('div'); d.textContent = str == null ? '' : String(str); return d.innerHTML; }

  async function apiGet() {
    if (token) {
      return fetch(`${API}/dorm-inquiries/followup/${inquiryId}?token=${encodeURIComponent(token)}`);
    }
    if (window.RMD_AUTH && window.RMD_AUTH.getAccessToken()) {
      return window.RMD_AUTH.authenticatedFetch(`${API}/dorm-inquiries/followup/${inquiryId}`);
    }
    return null;
  }

  async function apiPatchOutcome(outcome) {
    const body = { outcome };
    if (token) body.token = token;
    if (token) {
      return fetch(`${API}/dorm-inquiries/${inquiryId}/outcome`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    }
    return window.RMD_AUTH.authenticatedFetch(`${API}/dorm-inquiries/${inquiryId}/outcome`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  function renderCard(data) {
    $('cardTitle').textContent = data.listingTitle || '';
    $('cardMeta').textContent = [data.listingCity, 'Réf. ' + data.uniqueReference].filter(Boolean).join(' · ');
    $('card').hidden = false;
    if (data.studentOutcome) markAnswered();
  }

  function markAnswered() {
    answered = true;
    const card = $('card');
    card.classList.add('answered');
    $('thanks').classList.add('show');
  }

  async function load() {
    hideAllStates();
    $('loadingState').hidden = false;

    if (!inquiryId || (!token && !(window.RMD_AUTH && window.RMD_AUTH.getAccessToken()))) {
      hideAllStates();
      $('invalidState').hidden = false;
      return;
    }

    try {
      const res = await apiGet();
      if (!res || res.status === 404 || res.status === 401) {
        hideAllStates();
        $('invalidState').hidden = false;
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.success) throw new Error('request failed');
      hideAllStates();
      renderCard(data.data);
    } catch (err) {
      hideAllStates();
      $('errorState').hidden = false;
    }
  }

  async function submitOutcome(outcome, buttonEl) {
    if (answered) return;
    const actions = $('cardActions');
    actions.querySelectorAll('button').forEach((b) => { b.disabled = true; });

    try {
      const res = await apiPatchOutcome(outcome);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.success) throw new Error((data && data.message) || 'Une erreur est survenue.');
      markAnswered();
    } catch (err) {
      actions.querySelectorAll('button').forEach((b) => { b.disabled = false; });
      if (window.RMD_SHARED) window.RMD_SHARED.toast(err.message || 'Une erreur est survenue.', 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('cardActions').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-outcome]');
      if (btn) submitOutcome(btn.dataset.outcome, btn);
    });
    const retryBtn = $('retryBtn');
    if (retryBtn) retryBtn.addEventListener('click', load);
    load();
  });
})();
