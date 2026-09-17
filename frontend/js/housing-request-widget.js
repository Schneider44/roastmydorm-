/**
 * The admin-mediated "Demander ce logement" flow - a self-contained widget
 * used two ways:
 *  1. As a modal, opened from property-detail.js over a Dorm listing
 *     (window.RMD_HOUSING_REQUEST.openModal(listing)).
 *  2. As the standalone status page (housing-request-status.html), which
 *     reuses the exact same Step 2/3 render functions so the "reopen from
 *     your email" experience is pixel-identical to what a student saw
 *     right after submitting.
 *
 * Deliberately calls ONLY /api/housing-requests - never
 * /api/dorm-inquiries (the legacy direct-contact endpoint) and never opens
 * a wa.me/tel:/mailto: link. No landlord contact value is ever read from
 * any API response this file touches - the response shapes it consumes
 * (POST / and GET /:reference) structurally cannot contain one (see the
 * backend's strict allowlist serializers).
 */
(function (global) {
  'use strict';

  const API = (function () {
    const h = window.location.hostname;
    return (h === 'localhost' || h === '127.0.0.1' || h === '') ? 'http://localhost:5000/api' : 'https://www.roastmydorm.com/api';
  })();

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function money(n) {
    if (n == null) return '';
    return Number(n).toLocaleString('fr-FR') + ' MAD';
  }

  // ── Property summary card (used in the form, step 2 and step 3) ────────
  function renderPropertyCard(listing) {
    return `
      <div class="hrq-property-card">
        ${listing.image ? `<img src="${esc(listing.image)}" alt="" class="hrq-property-img" width="80" height="80" loading="lazy">` : `<div class="hrq-property-img hrq-property-img--placeholder"><i class="fa-solid fa-house" aria-hidden="true"></i></div>`}
        <div class="hrq-property-info">
          <h3>${esc(listing.title)}</h3>
          ${listing.city || listing.neighborhood ? `<p class="hrq-property-loc"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${esc([listing.neighborhood, listing.city].filter(Boolean).join(', '))}</p>` : ''}
          ${listing.price ? `<p class="hrq-property-price">${money(listing.price)} <span>/ mois</span></p>` : ''}
        </div>
      </div>`;
  }

  const STATUS_BADGE = {
    new: { label: 'À vérifier', cls: 'warn' },
    reviewing: { label: 'En cours de vérification', cls: 'warn' },
    checking_availability: { label: 'Vérification en cours', cls: 'warn' },
    available: { label: 'Disponible', cls: 'ok' },
    awaiting_student_consent: { label: 'À vérifier', cls: 'warn' },
    handoff_sent: { label: 'Disponible', cls: 'ok' },
    reserved: { label: 'Réservé', cls: 'muted' },
    unavailable: { label: 'Indisponible', cls: 'muted' },
    landlord_unreachable: { label: 'À vérifier', cls: 'warn' },
    closed: { label: 'Clôturée', cls: 'muted' },
  };

  function renderPropertyCardWithBadge(listing, mediationStatus) {
    const badge = STATUS_BADGE[mediationStatus] || STATUS_BADGE.new;
    return `
      <div class="hrq-property-card">
        ${listing.image ? `<img src="${esc(listing.image)}" alt="" class="hrq-property-img" width="80" height="80" loading="lazy">` : `<div class="hrq-property-img hrq-property-img--placeholder"><i class="fa-solid fa-house" aria-hidden="true"></i></div>`}
        <div class="hrq-property-info">
          <h3>${esc(listing.title)}</h3>
          ${listing.city || listing.neighborhood ? `<p class="hrq-property-loc"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ${esc([listing.neighborhood, listing.city].filter(Boolean).join(', '))}</p>` : ''}
          ${listing.price ? `<p class="hrq-property-price">${money(listing.price)} <span>/ mois</span></p>` : ''}
          <span class="hrq-badge hrq-badge--${badge.cls}"><i class="fa-solid fa-clock" aria-hidden="true"></i> ${badge.label}</span>
        </div>
      </div>`;
  }

  // ── Step 1: the form ─────────────────────────────────────────────────
  function renderStep1(listing, prefill) {
    return `
      <div class="hrq-timeline">
        <div class="hrq-tl-step hrq-tl-step--active"><span class="hrq-tl-dot">1</span><span>Tes informations</span></div>
        <div class="hrq-tl-line"></div>
        <div class="hrq-tl-step"><span class="hrq-tl-dot">2</span><span>Vérification</span></div>
        <div class="hrq-tl-line"></div>
        <div class="hrq-tl-step"><span class="hrq-tl-dot">3</span><span>Réponse</span></div>
      </div>
      ${renderPropertyCard(listing)}
      <h2 class="hrq-h1">Demander ce logement</h2>
      <p class="hrq-lead">Envoie ta demande à RoastMyDorm. Nous vérifierons la disponibilité auprès du propriétaire.</p>
      <form id="hrqForm" novalidate>
        <input type="text" name="website" id="hrqWebsite" autocomplete="off" tabindex="-1" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0;" aria-hidden="true">
        <div class="hrq-field">
          <label for="hrqName">Nom complet *</label>
          <div class="hrq-input-wrap"><i class="fa-regular fa-user" aria-hidden="true"></i><input class="hrq-input" type="text" id="hrqName" name="name" required maxlength="200" value="${esc(prefill.name || '')}" placeholder="Sara El Mansouri"></div>
        </div>
        <div class="hrq-field">
          <label for="hrqEmail">Adresse e-mail *</label>
          <div class="hrq-input-wrap"><i class="fa-regular fa-envelope" aria-hidden="true"></i><input class="hrq-input" type="email" id="hrqEmail" name="email" required maxlength="254" value="${esc(prefill.email || '')}" placeholder="sara@example.com"></div>
        </div>
        <div class="hrq-row2">
          <div class="hrq-field hrq-field--cc">
            <label for="hrqCc">Indicatif</label>
            <div class="hrq-input-wrap"><input class="hrq-input" type="text" id="hrqCc" name="phoneCountryCode" maxlength="6" value="+212"></div>
          </div>
          <div class="hrq-field hrq-field--phone">
            <label for="hrqPhone">Téléphone / WhatsApp *</label>
            <div class="hrq-input-wrap"><i class="fa-solid fa-phone" aria-hidden="true"></i><input class="hrq-input" type="tel" id="hrqPhone" name="phone" required maxlength="20" placeholder="6 12 34 56 78"></div>
          </div>
        </div>
        <div class="hrq-field">
          <label for="hrqUniversity">Université ou école *</label>
          <div class="hrq-input-wrap"><i class="fa-solid fa-graduation-cap" aria-hidden="true"></i><input class="hrq-input" type="text" id="hrqUniversity" name="university" required maxlength="200" placeholder="Université Cadi Ayyad"></div>
        </div>
        <div class="hrq-field">
          <span class="hrq-label-static">Moyen de contact préféré *</span>
          <div class="hrq-pref-group" role="radiogroup" aria-label="Moyen de contact préféré">
            <button type="button" class="hrq-pref-btn hrq-pref-btn--active" data-value="whatsapp" role="radio" aria-checked="true"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> WhatsApp</button>
            <button type="button" class="hrq-pref-btn" data-value="email" role="radio" aria-checked="false"><i class="fa-regular fa-envelope" aria-hidden="true"></i> E-mail</button>
            <button type="button" class="hrq-pref-btn" data-value="phone" role="radio" aria-checked="false"><i class="fa-solid fa-phone" aria-hidden="true"></i> Appel</button>
          </div>
          <input type="hidden" name="preferredContactMethod" id="hrqPref" value="whatsapp">
        </div>
        <div class="hrq-field">
          <label for="hrqMessage">Ton message (facultatif)</label>
          <textarea class="hrq-textarea" id="hrqMessage" name="message" maxlength="500" rows="3" placeholder="Bonjour, je suis intéressé(e) par cette chambre. Est-elle toujours disponible ? Merci !"></textarea>
          <span class="hrq-charcount"><span id="hrqCharCount">0</span>/500 caractères</span>
        </div>
        <label class="hrq-consent-row">
          <input type="checkbox" id="hrqConsent" name="consent" required>
          <span>J'accepte que RoastMyDorm utilise mes informations pour traiter cette demande.</span>
        </label>
        <div class="hrq-error" id="hrqError" hidden></div>
        <button type="submit" class="hrq-submit-btn" id="hrqSubmitBtn">Envoyer ma demande <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
        <p class="hrq-secure-note"><i class="fa-solid fa-lock" aria-hidden="true"></i> Tes coordonnées restent privées et ne sont jamais affichées publiquement.</p>
      </form>`;
  }

  // ── Step 2: pending/verification ────────────────────────────────────
  function renderStep2(data) {
    return `
      <p class="hrq-ref">Demande ${esc(data.reference)}</p>
      <h2 class="hrq-h1">Nous vérifions la disponibilité</h2>
      <p class="hrq-lead">Ta demande a bien été reçue. Notre équipe contacte maintenant le propriétaire.</p>
      ${renderPropertyCardWithBadge(data.listing, data.mediationStatus)}
      <div class="hrq-progress">
        <div class="hrq-progress-step hrq-progress-step--done"><span class="hrq-progress-icon"><i class="fa-solid fa-check" aria-hidden="true"></i></span><div><b>Demande reçue</b><p>${new Date(data.createdAt).toLocaleString('fr-FR')}</p></div></div>
        <div class="hrq-progress-step hrq-progress-step--active"><span class="hrq-progress-icon"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i></span><div><b>Contact du propriétaire</b><p>En cours</p></div></div>
        <div class="hrq-progress-step"><span class="hrq-progress-icon"><i class="fa-regular fa-envelope" aria-hidden="true"></i></span><div><b>Réponse envoyée</b><p>Dès que nous avons une confirmation</p></div></div>
      </div>
      <div class="hrq-info-box"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> Tu n'as rien à faire pour le moment. Nous t'écrirons par e-mail dès que la disponibilité sera confirmée.</div>
      <a class="hrq-secondary-btn" href="mailto:contact@roastmydorm.com">Une question ? Contacter RoastMyDorm</a>`;
  }

  // ── Step 3: four result states ───────────────────────────────────────
  function renderStep3(data) {
    const status = data.mediationStatus;
    if (status === 'handoff_sent') return renderStep3Available(data);
    if (status === 'awaiting_student_consent') return renderStep3ConsentNeeded(data);
    if (status === 'unavailable' || (status === 'closed' && data.closureReason === 'listing_permanently_unavailable')) return renderStep3Unavailable(data);
    if (status === 'reserved') return renderStep3Reserved(data);
    if (status === 'landlord_unreachable') return renderStep3Unreachable(data);
    return renderStep2(data); // still pending
  }

  function renderStep3Available(data) {
    return `
      <p class="hrq-ref">Demande ${esc(data.reference)}</p>
      <div class="hrq-result-icon hrq-result-icon--ok"><i class="fa-solid fa-check" aria-hidden="true"></i></div>
      <h2 class="hrq-h1">La mise en relation est faite</h2>
      <p class="hrq-lead">Le propriétaire a reçu tes coordonnées et va te contacter directement.</p>
      ${renderPropertyCardWithBadge(data.listing, data.mediationStatus)}
      <div class="hrq-info-box hrq-info-box--ok"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Tes coordonnées ont été transmises au propriétaire avec ton accord. Il/elle devrait te contacter via ton moyen préféré prochainement.</div>
      <a class="hrq-secondary-btn" href="/">Voir d'autres logements</a>`;
  }

  function renderStep3ConsentNeeded(data) {
    return `
      <p class="hrq-ref">Demande ${esc(data.reference)}</p>
      <div class="hrq-result-icon hrq-result-icon--ok"><i class="fa-solid fa-check" aria-hidden="true"></i></div>
      <h2 class="hrq-h1">Bonne nouvelle, le logement est disponible</h2>
      <p class="hrq-lead">Le propriétaire a confirmé la disponibilité. Pour te mettre en relation, nous avons besoin de ton accord.</p>
      ${renderPropertyCardWithBadge(data.listing, data.mediationStatus)}
      <div class="hrq-progress hrq-progress--compact">
        <div class="hrq-progress-step hrq-progress-step--done"><span class="hrq-progress-icon"><i class="fa-solid fa-check" aria-hidden="true"></i></span><div><b>Demande reçue</b></div></div>
        <div class="hrq-progress-step hrq-progress-step--done"><span class="hrq-progress-icon"><i class="fa-solid fa-check" aria-hidden="true"></i></span><div><b>Disponibilité confirmée</b></div></div>
        <div class="hrq-progress-step hrq-progress-step--active"><span class="hrq-progress-icon"><i class="fa-solid fa-hand" aria-hidden="true"></i></span><div><b>Ton accord requis</b></div></div>
      </div>
      <label class="hrq-consent-row hrq-consent-row--highlight">
        <input type="checkbox" id="hrqShareConsent">
        <span>J'autorise RoastMyDorm à transmettre mes coordonnées au propriétaire de ce logement.</span>
      </label>
      <div class="hrq-error" id="hrqConsentError" hidden></div>
      <button type="button" class="hrq-submit-btn" id="hrqConsentBtn">Continuer avec RoastMyDorm <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
      <p class="hrq-secure-note"><i class="fa-solid fa-lock" aria-hidden="true"></i> Tes coordonnées restent privées jusqu'à ton accord explicite.</p>`;
  }

  function renderStep3Unavailable(data) {
    return `
      <p class="hrq-ref">Demande ${esc(data.reference)}</p>
      <div class="hrq-result-icon hrq-result-icon--muted"><i class="fa-solid fa-xmark" aria-hidden="true"></i></div>
      <h2 class="hrq-h1">Ce logement n'est malheureusement plus disponible</h2>
      ${renderPropertyCardWithBadge(data.listing, data.mediationStatus)}
      <p class="hrq-lead">Nous t'invitons à consulter d'autres logements correspondant à tes critères.</p>
      <a class="hrq-submit-btn hrq-submit-btn--link" href="/${(data.listing.city || '').toLowerCase() === 'marrakech' ? 'marrakech-dorms.html' : (data.listing.city || '').toLowerCase() === 'casablanca' ? 'casablanca-dorms.html' : 'rabat-dorms.html'}">Voir des logements similaires</a>
      <a class="hrq-secondary-btn" href="/">Modifier mes critères</a>`;
  }

  function renderStep3Reserved(data) {
    return `
      <p class="hrq-ref">Demande ${esc(data.reference)}</p>
      <div class="hrq-result-icon hrq-result-icon--muted"><i class="fa-solid fa-hourglass-half" aria-hidden="true"></i></div>
      <h2 class="hrq-h1">Ce logement est temporairement réservé</h2>
      ${renderPropertyCardWithBadge(data.listing, data.mediationStatus)}
      <p class="hrq-lead">Un autre candidat est actuellement en cours de finalisation. Nous te tiendrons informé(e) si la situation évolue.</p>
      <a class="hrq-submit-btn hrq-submit-btn--link" href="/${(data.listing.city || '').toLowerCase() === 'marrakech' ? 'marrakech-dorms.html' : (data.listing.city || '').toLowerCase() === 'casablanca' ? 'casablanca-dorms.html' : 'rabat-dorms.html'}">Voir des logements similaires</a>`;
  }

  function renderStep3Unreachable(data) {
    return `
      <p class="hrq-ref">Demande ${esc(data.reference)}</p>
      <div class="hrq-result-icon hrq-result-icon--muted"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></div>
      <h2 class="hrq-h1">Impossible de confirmer la disponibilité</h2>
      ${renderPropertyCardWithBadge(data.listing, data.mediationStatus)}
      <p class="hrq-lead">Nous n'avons pas réussi à joindre le propriétaire de ce logement. Nous ne pouvons donc pas confirmer sa disponibilité pour le moment.</p>
      <a class="hrq-submit-btn hrq-submit-btn--link" href="/${(data.listing.city || '').toLowerCase() === 'marrakech' ? 'marrakech-dorms.html' : (data.listing.city || '').toLowerCase() === 'casablanca' ? 'casablanca-dorms.html' : 'rabat-dorms.html'}">Voir des logements similaires</a>
      <a class="hrq-secondary-btn" href="mailto:contact@roastmydorm.com">Contacter le support</a>`;
  }

  // ── Networking ────────────────────────────────────────────────────────
  function authHeaders() {
    const h = { 'Content-Type': 'application/json' };
    if (window.RMD_AUTH && window.RMD_AUTH.getAccessToken && window.RMD_AUTH.getAccessToken()) {
      h.Authorization = 'Bearer ' + window.RMD_AUTH.getAccessToken();
    }
    const stored = sessionStorage.getItem('hrq_token_' + (window.__hrqCurrentRef || ''));
    if (stored) h['X-Housing-Request-Token'] = stored;
    return h;
  }

  async function submitRequest(listingId, formData) {
    // Must reuse authHeaders() (not a bare Content-Type header) so a
    // logged-in student's Authorization token actually reaches the server -
    // without it the backend has no req.user and silently creates every
    // submission as a guest, regardless of login state.
    const res = await fetch(API + '/housing-requests', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ listingId, ...formData }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || !json.success) throw new Error((json && json.message) || 'Une erreur est survenue.');
    return json.data;
  }

  async function fetchStatus(reference, token) {
    const headers = {};
    if (window.RMD_AUTH && window.RMD_AUTH.getAccessToken && window.RMD_AUTH.getAccessToken()) headers.Authorization = 'Bearer ' + window.RMD_AUTH.getAccessToken();
    if (token) headers['X-Housing-Request-Token'] = token;
    const res = await fetch(API + '/housing-requests/' + encodeURIComponent(reference), { headers, cache: 'no-store' });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || !json.success) throw new Error((json && json.message) || 'Demande introuvable.');
    return json.data;
  }

  async function giveConsent(reference, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (window.RMD_AUTH && window.RMD_AUTH.getAccessToken && window.RMD_AUTH.getAccessToken()) headers.Authorization = 'Bearer ' + window.RMD_AUTH.getAccessToken();
    if (token) headers['X-Housing-Request-Token'] = token;
    const res = await fetch(API + '/housing-requests/' + encodeURIComponent(reference) + '/consent', {
      method: 'POST', headers, body: JSON.stringify({ consent: true }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || !json.success) throw new Error((json && json.message) || 'Une erreur est survenue.');
    return json.data;
  }

  // ── Modal wiring ─────────────────────────────────────────────────────
  let modalEl = null;
  let lastFocused = null;

  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = el('div', 'hrq-modal-overlay');
    modalEl.id = 'housingRequestModal';
    modalEl.hidden = true;
    modalEl.innerHTML = `
      <div class="hrq-modal" role="dialog" aria-modal="true" aria-labelledby="hrqTitle">
        <button type="button" class="hrq-close-btn" id="hrqCloseBtn" aria-label="Fermer"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        <div class="hrq-modal-body" id="hrqModalBody"></div>
      </div>`;
    document.body.appendChild(modalEl);
    modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeModal(); });
    modalEl.querySelector('#hrqCloseBtn').addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modalEl.hidden) closeModal(); });
    return modalEl;
  }

  function trapFocus(container) {
    const focusables = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    container.addEventListener('keydown', function handler(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  function openModal(listing) {
    const modal = ensureModal();
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    const body = modal.querySelector('#hrqModalBody');
    const prefill = {};
    if (window.RMD_AUTH && window.RMD_AUTH.getCurrentUser) {
      const u = window.RMD_AUTH.getCurrentUser();
      if (u) { prefill.name = [u.firstName, u.lastName].filter(Boolean).join(' '); prefill.email = u.email; }
    }
    // One key per modal-open, reused for every submit attempt from this
    // same form instance (including a retry after a validation error or a
    // slow-network resend) - an additional, purely best-effort defense
    // against a genuine double-click/double-submit on TOP OF the server's
    // real atomic guarantee (services/housingRequestDedupClaim.js), never
    // a substitute for it - see that file's own comment on why.
    const idempotencyKey = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('idk_' + Date.now() + '_' + Math.random().toString(36).slice(2));
    body.innerHTML = renderStep1(listing, prefill);
    wireStep1(body, listing, idempotencyKey);
    trapFocus(modal);
    const firstInput = body.querySelector('#hrqName');
    if (firstInput) firstInput.focus();
  }

  function closeModal() {
    if (!modalEl) return;
    modalEl.hidden = true;
    document.body.style.overflow = '';
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function wireStep1(container, listing, idempotencyKey) {
    const form = container.querySelector('#hrqForm');
    const prefBtns = container.querySelectorAll('.hrq-pref-btn');
    const prefInput = container.querySelector('#hrqPref');
    prefBtns.forEach((btn) => btn.addEventListener('click', () => {
      prefBtns.forEach((b) => { b.classList.remove('hrq-pref-btn--active'); b.setAttribute('aria-checked', 'false'); });
      btn.classList.add('hrq-pref-btn--active');
      btn.setAttribute('aria-checked', 'true');
      prefInput.value = btn.dataset.value;
    }));
    const msg = container.querySelector('#hrqMessage');
    const count = container.querySelector('#hrqCharCount');
    msg.addEventListener('input', () => { count.textContent = msg.value.length; });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = container.querySelector('#hrqError');
      errorEl.hidden = true;
      const consentEl = container.querySelector('#hrqConsent');
      if (!consentEl.checked) { errorEl.textContent = 'Merci de cocher la case de consentement.'; errorEl.hidden = false; return; }
      const btn = container.querySelector('#hrqSubmitBtn');
      btn.disabled = true;
      btn.textContent = 'Envoi en cours…';
      try {
        const fd = new FormData(form);
        const payload = {
          website: fd.get('website') || '',
          name: fd.get('name'), email: fd.get('email'),
          phoneCountryCode: fd.get('phoneCountryCode'), phone: fd.get('phone'),
          university: fd.get('university'), preferredContactMethod: fd.get('preferredContactMethod'),
          message: fd.get('message') || '', consent: true,
          sourcePage: window.location.pathname,
          idempotencyKey,
        };
        const data = await submitRequest(listing.id, payload);
        window.__hrqCurrentRef = data.reference;
        const full = { ...data, listing };
        container.innerHTML = renderStep2(full);
      } catch (err) {
        errorEl.textContent = err.message || 'Une erreur est survenue. Réessaie.';
        errorEl.hidden = false;
        btn.disabled = false;
        btn.innerHTML = 'Envoyer ma demande <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';
      }
    });
  }

  // ── Standalone status-page wiring (housing-request-status.html) ────────
  async function mountStatusPage(container, reference, token) {
    container.innerHTML = '<div class="hrq-loading">Chargement…</div>';
    try {
      const data = await fetchStatus(reference, token);
      window.__hrqCurrentRef = reference;
      if (token) sessionStorage.setItem('hrq_token_' + reference, token);
      renderResult(container, data, reference, token);
    } catch (err) {
      container.innerHTML = `<div class="hrq-result-icon hrq-result-icon--muted"><i class="fa-solid fa-triangle-exclamation"></i></div><h2 class="hrq-h1">Demande introuvable</h2><p class="hrq-lead">${esc(err.message)}</p>`;
    }
  }

  function renderResult(container, data, reference, token) {
    container.innerHTML = renderStep3(data);
    const consentBtn = container.querySelector('#hrqConsentBtn');
    if (consentBtn) {
      consentBtn.addEventListener('click', async () => {
        const checkbox = container.querySelector('#hrqShareConsent');
        const errorEl = container.querySelector('#hrqConsentError');
        errorEl.hidden = true;
        if (!checkbox.checked) { errorEl.textContent = 'Merci de cocher la case pour continuer.'; errorEl.hidden = false; return; }
        consentBtn.disabled = true;
        consentBtn.textContent = 'Envoi en cours…';
        try {
          const updated = await giveConsent(reference, token);
          renderResult(container, updated, reference, token);
        } catch (err) {
          errorEl.textContent = err.message;
          errorEl.hidden = false;
          consentBtn.disabled = false;
          consentBtn.innerHTML = 'Continuer avec RoastMyDorm <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>';
        }
      });
    }
  }

  global.RMD_HOUSING_REQUEST = {
    openModal,
    closeModal,
    mountStatusPage,
    renderStep1, renderStep2, renderStep3, // exposed for local/manual QA
  };
})(window);
