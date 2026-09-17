/**
 * "Mes demandes" - Section 1: the authenticated student's own
 * admin_mediated ("Demandes de logement") requests. Deliberately a
 * separate file from js/mes-demandes.js (the legacy /api/dorm-inquiries
 * list, untouched) - different endpoint, different data shape, different
 * serializer, and the two lists must stay visually/structurally separate
 * per the explicit "never blend the two flows" requirement.
 *
 * Ownership is enforced by the backend query itself
 * (GET /api/housing-requests/mine - `student: req.user._id`, see
 * routes/housingRequests.js), never by filtering results in this file -
 * this page only ever renders exactly what the server already scoped to
 * the logged-in student.
 *
 * Uses toStudentMediationView()'s exact field set - there is structurally
 * no landlord contact field in the response this file ever touches.
 */
(function () {
  'use strict';

  const API = ['localhost', '127.0.0.1', ''].includes(window.location.hostname)
    ? 'http://localhost:5000/api' : 'https://www.roastmydorm.com/api';

  const $ = (id) => document.getElementById(id);

  const STATUS_BADGE = {
    new: { label: 'À vérifier', cls: 'warn' },
    reviewing: { label: 'En cours de vérification', cls: 'warn' },
    checking_availability: { label: 'Vérification en cours', cls: 'warn' },
    available: { label: 'Disponible', cls: 'ok' },
    awaiting_student_consent: { label: 'Ton accord est nécessaire', cls: 'warn' },
    handoff_sent: { label: 'Mise en relation faite', cls: 'ok' },
    reserved: { label: 'Réservé', cls: 'muted' },
    unavailable: { label: 'Indisponible', cls: 'muted' },
    landlord_unreachable: { label: 'À vérifier', cls: 'warn' },
    closed: { label: 'Clôturée', cls: 'muted' },
  };

  function hideAllStates() {
    ['hrqLoadingState', 'hrqNotLoggedInState', 'hrqSessionExpiredState', 'hrqEmptyState', 'hrqErrorState'].forEach((id) => {
      const el = $(id); if (el) el.hidden = true;
    });
  }

  function formatDate(iso) {
    try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch { return ''; }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function renderCard(req) {
    const badge = STATUS_BADGE[req.mediationStatus] || STATUS_BADGE.new;
    const needsConsent = req.mediationStatus === 'awaiting_student_consent';

    const card = document.createElement('article');
    card.className = 'hrq-md-card';
    card.setAttribute('role', 'link');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Voir la demande ${req.reference}`);
    card.innerHTML = `
      <div class="hrq-md-card-top">
        <img class="hrq-md-card-photo" src="${escapeHtml(req.listing.image || 'roastmydorm_logo-removebg-preview.png')}" alt="" loading="lazy">
        <div class="hrq-md-card-body">
          <p class="hrq-md-card-title">${escapeHtml(req.listing.title || 'Logement')}</p>
          <p class="hrq-md-card-meta">${escapeHtml(req.listing.city || '')} · Réf. ${escapeHtml(req.reference)}</p>
          <p class="hrq-md-card-meta">Envoyée le ${formatDate(req.createdAt)}</p>
          <span class="hrq-badge hrq-badge--${badge.cls}"><i class="fa-solid fa-clock" aria-hidden="true"></i> ${escapeHtml(badge.label)}</span>
        </div>
      </div>
      ${needsConsent ? '<div class="hrq-md-consent-cta"><i class="fa-solid fa-hand" aria-hidden="true"></i> Ton accord est nécessaire - clique pour continuer</div>' : ''}
    `;
    const go = () => { window.location.href = `housing-request-status.html?ref=${encodeURIComponent(req.reference)}`; };
    card.addEventListener('click', go);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    return card;
  }

  function render(requests) {
    const list = $('hrqList');
    list.innerHTML = '';
    if (!requests.length) {
      hideAllStates();
      $('hrqEmptyState').hidden = false;
      list.hidden = true;
      return;
    }
    hideAllStates();
    list.hidden = false;
    requests.forEach((req) => list.appendChild(renderCard(req)));
  }

  async function load() {
    hideAllStates();
    $('hrqLoadingState').hidden = false;

    if (!(window.RMD_AUTH && window.RMD_AUTH.getAccessToken())) {
      hideAllStates();
      $('hrqNotLoggedInState').hidden = false;
      return;
    }

    try {
      const res = await window.RMD_AUTH.authenticatedFetch(API + '/housing-requests/mine');
      if (res.status === 401) {
        hideAllStates();
        $('hrqSessionExpiredState').hidden = false;
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.success) throw new Error('request failed');
      render(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      hideAllStates();
      $('hrqErrorState').hidden = false;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const retryBtn = $('hrqRetryBtn');
    if (retryBtn) retryBtn.addEventListener('click', load);
    load();
  });
})();
