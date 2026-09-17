/**
 * "Mes demandes" - a student's own tracked contact requests
 * (GET /api/dorm-inquiries/mine) with a one-tap rental-outcome response
 * (PATCH /api/dorm-inquiries/:id/outcome). Read-only listing plus a single
 * mutation, so this stays a small vanilla-JS page consistent with the rest
 * of the site - no framework, no build step.
 */
(function () {
  'use strict';

  const API = ['localhost', '127.0.0.1', ''].includes(window.location.hostname)
    ? 'http://localhost:5000/api' : 'https://www.roastmydorm.com/api';

  // Outcome stages where the student hasn't given a definitive final claim
  // yet - these are the only inquiries offered the one-tap response UI.
  // Deliberately excludes rental_confirmed/not_rented/listing_unavailable/
  // no_response/cancelled (terminal) - there is nothing left to ask.
  const RESPONDABLE_OUTCOME_STATUSES = ['contact_initiated', 'landlord_responded', 'visit_scheduled', 'rental_reported'];

  const OUTCOME_STATUS_LABELS = {
    contact_initiated: 'Contact envoyé',
    landlord_responded: 'Propriétaire a répondu',
    visit_scheduled: 'Visite prévue',
    rental_reported: 'Location déclarée - en attente de confirmation',
    rental_confirmed: 'Location confirmée',
    no_response: 'Sans réponse',
    not_rented: 'Non loué',
    listing_unavailable: 'Logement indisponible',
    cancelled: 'Annulé',
  };
  const OUTCOME_STATUS_BADGE_CLASS = {
    contact_initiated: 'md-status-pending',
    landlord_responded: 'md-status-progress',
    visit_scheduled: 'md-status-progress',
    rental_reported: 'md-status-progress',
    rental_confirmed: 'md-status-confirmed',
    no_response: 'md-status-closed',
    not_rented: 'md-status-closed',
    listing_unavailable: 'md-status-closed',
    cancelled: 'md-status-closed',
  };

  const $ = (id) => document.getElementById(id);
  let inquiries = [];
  let submitting = new Set(); // inquiry ids with an in-flight PATCH - blocks double-tap at the UI layer too, not just relying on the server's idempotency

  function apiFetch(path, options) {
    return window.RMD_AUTH.authenticatedFetch(API + path, options);
  }

  function hideAllStates() {
    ['loadingState', 'notLoggedInState', 'sessionExpiredState', 'emptyState', 'errorState'].forEach((id) => {
      const el = $(id); if (el) el.hidden = true;
    });
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return ''; }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function renderCard(inquiry) {
    const canRespond = RESPONDABLE_OUTCOME_STATUSES.includes(inquiry.outcomeStatus);
    const statusLabel = OUTCOME_STATUS_LABELS[inquiry.outcomeStatus] || inquiry.outcomeStatus;
    const badgeClass = OUTCOME_STATUS_BADGE_CLASS[inquiry.outcomeStatus] || 'md-status-pending';

    const card = document.createElement('div');
    card.className = 'md-card';
    card.dataset.inquiryId = inquiry._id;
    card.innerHTML = `
      <div class="md-card-top">
        <img class="md-card-photo" src="${escapeHtml(inquiry.listingImage || 'roastmydorm_logo-removebg-preview.png')}" alt="" loading="lazy">
        <div class="md-card-body">
          <p class="md-card-title">${escapeHtml(inquiry.listingTitle)}</p>
          <p class="md-card-meta">${escapeHtml(inquiry.listingCity || '')} · Réf. ${escapeHtml(inquiry.uniqueReference)}</p>
          <p class="md-card-meta">Contacté le ${formatDate(inquiry.createdAt)}</p>
          <span class="md-status-badge ${badgeClass}">${escapeHtml(statusLabel)}</span>
        </div>
      </div>
      ${canRespond ? `
      <div class="md-outcome-prompt">
        <p>As-tu réussi à louer ce logement ?</p>
        <div class="md-outcome-actions">
          <button type="button" class="md-outcome-rented" data-outcome="rented">Oui, j'ai loué</button>
          <button type="button" data-outcome="visit_scheduled">Visite prévue / en cours</button>
          <button type="button" data-outcome="still_searching">Non, je cherche toujours</button>
          <button type="button" class="md-outcome-unavailable" data-outcome="listing_unavailable">Non, plus disponible</button>
        </div>
      </div>` : ''}
    `;
    return card;
  }

  function render() {
    const list = $('inquiryList');
    list.innerHTML = '';
    if (!inquiries.length) {
      hideAllStates();
      $('emptyState').hidden = false;
      list.hidden = true;
      return;
    }
    hideAllStates();
    list.hidden = false;
    inquiries.forEach((inquiry) => list.appendChild(renderCard(inquiry)));
  }

  async function submitOutcome(inquiryId, outcome, buttonEl) {
    if (submitting.has(inquiryId)) return; // in-flight guard - the server is idempotent too, but this avoids a redundant second request on a fast double-tap
    submitting.add(inquiryId);
    const card = buttonEl.closest('.md-card');
    card.querySelectorAll('button').forEach((b) => { b.disabled = true; });

    try {
      const res = await apiFetch(`/dorm-inquiries/${inquiryId}/outcome`, {
        method: 'PATCH',
        body: JSON.stringify({ outcome }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.success) {
        throw new Error((data && data.message) || 'Une erreur est survenue.');
      }
      const idx = inquiries.findIndex((i) => i._id === inquiryId);
      if (idx !== -1) inquiries[idx] = data.data;
      window.RMD_SHARED.toast('Merci pour ta réponse !', 'success');
      render();
    } catch (err) {
      window.RMD_SHARED.toast(err.message || 'Une erreur est survenue.', 'error');
      card.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    } finally {
      submitting.delete(inquiryId);
    }
  }

  function wireListDelegation() {
    $('inquiryList').addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-outcome]');
      if (!btn) return;
      const card = btn.closest('.md-card');
      const inquiryId = card && card.dataset.inquiryId;
      const outcome = btn.dataset.outcome;
      if (inquiryId && outcome) submitOutcome(inquiryId, outcome, btn);
    });
  }

  async function load() {
    hideAllStates();
    $('loadingState').hidden = false;

    if (!(window.RMD_AUTH && window.RMD_AUTH.getAccessToken())) {
      hideAllStates();
      $('notLoggedInState').hidden = false;
      return;
    }

    try {
      const res = await apiFetch('/dorm-inquiries/mine');
      if (res.status === 401) {
        hideAllStates();
        $('sessionExpiredState').hidden = false;
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.success) throw new Error('request failed');
      inquiries = Array.isArray(data.data) ? data.data : [];
      render();
    } catch (err) {
      hideAllStates();
      $('errorState').hidden = false;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    wireListDelegation();
    const retryBtn = $('retryBtn');
    if (retryBtn) retryBtn.addEventListener('click', load);
    load();
  });
})();
