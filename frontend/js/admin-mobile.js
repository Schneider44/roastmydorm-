/**
 * Admin dashboard — mobile/tablet behavior layer.
 *
 * Loaded after admin.js. Never redeclares anything admin.js already
 * defines (state, apiRequest, navigateToPage, escapeHtml, formatDate,
 * showToast, confirmAction, the DC_* label/badge maps, viewUser,
 * editDorm, etc.) — it only reads/calls those as already-existing
 * globals. admin.js in turn calls into this file only through guarded
 * `window.xyz?.()` checks, so removing this file leaves admin.js fully
 * functional on its own (desktop behavior never depends on this file
 * existing).
 */
(function () {
  'use strict';

  const MOBILE_BREAKPOINT = 1024;
  const isMobile = () => window.innerWidth <= MOBILE_BREAKPOINT;

  const $ = (id) => document.getElementById(id);
  const esc = (v) => (window.escapeHtml ? window.escapeHtml(v) : String(v ?? ''));

  // ── Shared accessible overlay (drawer + "Plus" sheet) ──────────────────
  // One implementation, two callers. Handles backdrop, scroll-lock,
  // focus-trap, Escape, and focus-restore identically for both.
  const backdrop = $('mobile-drawer-backdrop');
  let activeOverlay = null; // { panelEl, triggerEl, keydownHandler }

  function getFocusable(el) {
    return Array.from(el.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
  }

  function trapFocus(e, panelEl) {
    if (e.key !== 'Tab') return;
    const focusable = getFocusable(panelEl);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function closeOverlay() {
    if (!activeOverlay) return;
    const { panelEl, triggerEl, keydownHandler, onClose } = activeOverlay;
    document.removeEventListener('keydown', keydownHandler);
    backdrop.classList.remove('show');
    backdrop.hidden = true;
    document.body.style.overflow = '';
    if (onClose) onClose();
    if (triggerEl && triggerEl.isConnected) triggerEl.focus();
    activeOverlay = null;
  }

  function openOverlay(panelEl, triggerEl, opts) {
    opts = opts || {};
    if (activeOverlay) closeOverlay();

    backdrop.hidden = false;
    // Force reflow so the opacity transition actually runs.
    void backdrop.offsetHeight;
    backdrop.classList.add('show');
    if (opts.onOpen) opts.onOpen();

    document.body.style.overflow = 'hidden';

    const keydownHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeOverlay();
        return;
      }
      trapFocus(e, panelEl);
    };
    document.addEventListener('keydown', keydownHandler);

    activeOverlay = { panelEl, triggerEl, keydownHandler, onClose: opts.onClose };

    const focusable = getFocusable(panelEl);
    if (focusable.length) focusable[0].focus();
  }

  backdrop?.addEventListener('click', () => closeOverlay());

  // ── Drawer wiring (extends the existing #mobile-menu-btn toggle) ───────
  const sidebar = $('sidebar');
  const menuBtn = $('mobile-menu-btn');

  if (sidebar && menuBtn) {
    sidebar.setAttribute('role', 'dialog');
    sidebar.setAttribute('aria-modal', 'true');
    sidebar.setAttribute('aria-label', 'Navigation');

    // admin.js's own listener (registered first) already does
    // sidebar.classList.toggle('mobile-open'). This is a second,
    // additive listener — it reads the resulting state, it never
    // toggles the class itself, so there's exactly one source of truth
    // for whether the drawer is open.
    menuBtn.addEventListener('click', () => {
      const isOpen = sidebar.classList.contains('mobile-open');
      menuBtn.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) {
        openOverlay(sidebar, menuBtn, {
          onClose: () => sidebar.classList.remove('mobile-open'),
        });
      } else {
        closeOverlay();
      }
    });
  }

  // navigateToPage() already removes 'mobile-open' on every navigation
  // (admin.js:339). If our overlay is the sidebar, mirror that close so
  // focus/scroll-lock/backdrop stay in sync with admin.js's own state.
  function closeDrawerIfOpen() {
    if (activeOverlay && activeOverlay.panelEl === sidebar) closeOverlay();
  }

  // ── Bottom nav ────────────────────────────────────────────────────────
  const BOTTOM_NAV_PAGES = ['dashboard', 'dorms', 'dorm-contacts'];
  const MORE_SHEET_PAGES = ['users', 'reviews', 'roommates', 'analytics', 'property-requests', 'housing-requests', 'reports', 'settings'];

  document.querySelectorAll('.bottom-nav-item[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeOverlay();
      if (typeof window.navigateToPage === 'function') window.navigateToPage(btn.dataset.page);
    });
  });

  const moreBtn = $('bottom-nav-more');
  const moreSheet = $('mobile-more-sheet');

  moreBtn?.addEventListener('click', () => {
    const isOpen = moreSheet.classList.contains('show');
    if (isOpen) {
      closeOverlay();
    } else {
      moreBtn.setAttribute('aria-expanded', 'true');
      openOverlay(moreSheet, moreBtn, {
        onOpen: () => moreSheet.classList.add('show'),
        onClose: () => {
          moreSheet.classList.remove('show');
          moreSheet.hidden = true;
          moreBtn.setAttribute('aria-expanded', 'false');
        },
      });
      moreSheet.hidden = false;
    }
  });

  moreSheet?.querySelectorAll('.mobile-more-item[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeOverlay();
      if (typeof window.navigateToPage === 'function') window.navigateToPage(btn.dataset.page);
    });
  });

  $('mobile-more-logout')?.addEventListener('click', () => {
    closeOverlay();
    // Exactly-once, exact-existing-handler: trigger the real logout
    // button rather than reimplementing logout.
    document.getElementById('logout-btn')?.click();
  });

  // Sync bottom-nav active state + auto-close any open overlay whenever
  // admin.js navigates (guarded call added at the end of navigateToPage()).
  window.syncMobileNavMobile = function syncMobileNavMobile(page) {
    closeDrawerIfOpen();
    if (activeOverlay && activeOverlay.panelEl === moreSheet) closeOverlay();

    document.querySelectorAll('.bottom-nav-item[data-page]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.page === page);
      btn.setAttribute('aria-current', btn.dataset.page === page ? 'page' : 'false');
    });
    if (moreBtn) moreBtn.classList.toggle('active', MORE_SHEET_PAGES.includes(page));

    if (isMobile()) triggerChartsResizeSoon();
  };

  // ── Generic card renderer ────────────────────────────────────────────
  function renderMobileCards(containerId, rows, config) {
    const container = $(containerId);
    if (!container) return;

    // The container starts `hidden` in the markup (desktop safety: outside
    // the @media(max-width:1024px) block, admin-mobile.css has no rule to
    // hide it at all, only the `hidden` attribute does - clearing it
    // unconditionally would show cards on desktop too). Only reveal it on
    // mobile/tablet viewports; a resize listener below keeps this correct
    // if the viewport crosses the breakpoint without a reload.
    container.hidden = !isMobile();

    if (!rows || rows.length === 0) {
      container.innerHTML = `<div class="mobile-card-empty">${esc(config.emptyMessage || 'Aucun résultat')}</div>`;
      return;
    }

    container.innerHTML = rows.map((row) => {
      const id = config.getId(row);
      const title = config.title ? config.title(row) : '';
      const subtitle = config.subtitle ? config.subtitle(row) : '';
      const media = config.media ? config.media(row) : null;
      const badges = (config.badges || []).map((b) => b(row)).filter(Boolean).join('');
      const fields = (config.fields || []).map((f) => {
        const val = f.get(row);
        if (val === undefined || val === null || val === '') return '';
        return `<div class="mobile-card-field"><span class="mobile-card-field-label">${esc(f.label)}</span><span class="mobile-card-field-value">${esc(val)}</span></div>`;
      }).join('');
      const extraHtml = config.extraBody ? config.extraBody(row) : '';

      return `
        <article class="mobile-card${config.cardClass ? ' ' + config.cardClass : ''}" data-row-id="${esc(id)}" role="listitem">
          <div class="mobile-card-header">
            ${config.selectable ? `<input type="checkbox" class="mobile-card-select" aria-label="Sélectionner" data-select-id="${esc(id)}">` : ''}
            ${media ? `<img class="mobile-card-media" src="${esc(media)}" alt="" loading="lazy">` : ''}
            <div class="mobile-card-heading">
              <p class="mobile-card-title">${esc(title)}</p>
              ${subtitle ? `<p class="mobile-card-subtitle">${esc(subtitle)}</p>` : ''}
            </div>
          </div>
          ${badges ? `<div class="mobile-card-badges">${badges}</div>` : ''}
          ${fields ? `<div class="mobile-card-fields">${fields}</div>` : ''}
          ${extraHtml}
          <div class="mobile-card-actions" data-row-id="${esc(id)}"></div>
        </article>
      `;
    }).join('');
    container.setAttribute('role', 'list');

    // Wire actions + selection after innerHTML is set, using the row
    // objects directly (closures), so each button calls its bound
    // existing handler exactly once — no event delegation string
    // parsing, no re-derivation of the id from the DOM.
    rows.forEach((row) => {
      const id = config.getId(row);
      const actionsEl = container.querySelector(`.mobile-card-actions[data-row-id="${CSS.escape(String(id))}"]`);
      if (actionsEl && config.actions) {
        config.actions.forEach((action) => {
          if (action.show && !action.show(row)) return;
          const btn = document.createElement('button');
          btn.type = 'button';
          if (action.primary) btn.className = 'primary';
          if (action.danger) btn.className = 'danger';
          const label = typeof action.label === 'function' ? action.label(row) : action.label;
          btn.innerHTML = `${action.icon ? `<i class="fas ${action.icon}" aria-hidden="true"></i>` : ''}<span>${esc(label)}</span>`;
          btn.addEventListener('click', () => action.onClick(row));
          actionsEl.appendChild(btn);
        });
      }
      if (config.selectable) {
        const cb = container.querySelector(`.mobile-card-select[data-select-id="${CSS.escape(String(id))}"]`);
        if (cb && config.onSelect) cb.addEventListener('change', () => config.onSelect(id, cb.checked));
      }
      if (config.wireExtra) config.wireExtra(row, container);
    });
  }
  window.renderMobileCards = renderMobileCards;

  // ── Shared badge helpers (reuse admin.js's own label/class maps where
  // they already exist, so labels never drift between table and card) ──
  function badge(text, tone) {
    if (!text) return '';
    return `<span class="mobile-badge tone-${tone}">${esc(text)}</span>`;
  }

  // ── Per-page card configs ───────────────────────────────────────────
  const USER_STATUS_TONE = { active: 'primary', inactive: 'neutral', banned: 'danger' };
  window.renderUsersCardsMobile = function (data) {
    const rows = (data && data.data && data.data.users) || [];
    renderMobileCards('users-cards', rows, {
      getId: (r) => r._id,
      selectable: true,
      onSelect: (id, checked) => { if (typeof window.updateSelectedUsers === 'function') window.updateSelectedUsers(); },
      title: (r) => [r.firstName, r.lastName].filter(Boolean).join(' ') || r.name || r.email,
      subtitle: (r) => r.email,
      badges: [
        (r) => badge(r.userType || r.role, 'primary'),
        (r) => badge(r.status, USER_STATUS_TONE[r.status] || 'neutral'),
      ],
      fields: [
        { label: 'Université', get: (r) => r.university },
        { label: 'Inscrit', get: (r) => (window.formatDate ? window.formatDate(r.createdAt) : r.createdAt) },
      ],
      actions: [
        { icon: 'fa-eye', label: 'Voir', onClick: (r) => window.viewUser && window.viewUser(r._id) },
        { icon: 'fa-ban', label: 'Bannir', danger: true, show: (r) => r.status !== 'banned', onClick: (r) => window.confirmAction && window.confirmAction('ban', 'user', r._id) },
      ],
      emptyMessage: 'Aucun utilisateur trouvé',
    });
  };

  // Label/badge maps below are declared with `const` in admin.js, which
  // (unlike a top-level `function` declaration) does NOT attach them to
  // `window` - but classic <script> tags on the same page DO share one
  // top-level lexical scope, so the bare identifiers themselves are
  // reachable here. `typeof` on a name never throws even if undeclared,
  // so this is a safe existence check with no eval() (production CSP
  // blocks unsafe-eval, same reason Chart.js had to be self-hosted).
  const DORM_STATUS_LABELS_REF = (typeof DORM_STATUS_LABELS !== 'undefined') ? DORM_STATUS_LABELS : {};
  const DC_STATUS_LABELS_REF = (typeof DC_STATUS_LABELS !== 'undefined') ? DC_STATUS_LABELS : {};
  const DC_STATUS_BADGE_CLASS_REF = (typeof DC_STATUS_BADGE_CLASS !== 'undefined') ? DC_STATUS_BADGE_CLASS : {};
  const DC_OUTCOME_LABELS_REF = (typeof DC_OUTCOME_LABELS !== 'undefined') ? DC_OUTCOME_LABELS : {};
  const DC_STUDENT_OUTCOME_LABELS_REF = (typeof DC_STUDENT_OUTCOME_LABELS !== 'undefined') ? DC_STUDENT_OUTCOME_LABELS : {};
  const DC_LANDLORD_OUTCOME_LABELS_REF = (typeof DC_LANDLORD_OUTCOME_LABELS !== 'undefined') ? DC_LANDLORD_OUTCOME_LABELS : {};
  const DC_METHOD_LABELS_REF = (typeof DC_METHOD_LABELS !== 'undefined') ? DC_METHOD_LABELS : {};

  window.renderDormsCardsMobile = function (data) {
    const rows = (data && data.data && data.data.dorms) || [];
    const STATUS_LABELS = DORM_STATUS_LABELS_REF;
    renderMobileCards('dorms-cards', rows, {
      getId: (r) => r._id,
      selectable: true,
      media: (r) => (r.images && r.images[0] && (r.images[0].url || r.images[0])) || '',
      title: (r) => r.name,
      subtitle: (r) => r.location?.address?.city,
      badges: [
        (r) => badge(STATUS_LABELS[r.status] || r.status, r.status === 'published' ? 'primary' : r.status === 'draft' ? 'warning' : 'neutral'),
        (r) => (r.availability?.isAvailable === false ? badge('Indisponible', 'danger') : ''),
      ],
      fields: [
        { label: 'Type', get: (r) => r.propertyType },
        { label: 'Loyer', get: (r) => r.pricing?.baseRent ? `${r.pricing.baseRent} MAD` : '' },
      ],
      actions: [
        { icon: 'fa-pen', label: 'Modifier', primary: true, onClick: (r) => window.editDorm && window.editDorm(r._id) },
        { icon: 'fa-eye', label: 'Aperçu', onClick: (r) => window.previewDorm && window.previewDorm(r._id) },
        { icon: 'fa-check', label: 'Publier', show: (r) => r.status !== 'published', onClick: (r) => window.publishDorm && window.publishDorm(r._id) },
        { icon: 'fa-eye-slash', label: 'Dépublier', show: (r) => r.status === 'published', onClick: (r) => window.unpublishDorm && window.unpublishDorm(r._id) },
        { icon: 'fa-copy', label: 'Dupliquer', onClick: (r) => window.duplicateDorm && window.duplicateDorm(r._id) },
        { icon: 'fa-box-archive', label: 'Archiver', show: (r) => r.status !== 'archived', onClick: (r) => window.archiveDorm && window.archiveDorm(r._id) },
      ],
      emptyMessage: 'Aucun logement trouvé',
    });
  };

  window.renderReviewsCardsMobile = function (data) {
    const rows = (data && data.data && data.data.reviews) || [];
    renderMobileCards('reviews-cards', rows, {
      getId: (r) => r._id,
      selectable: true,
      title: (r) => r.dorm?.name || 'Avis',
      subtitle: (r) => r.user ? [r.user.firstName, r.user.lastName].filter(Boolean).join(' ') : r.author,
      badges: [
        (r) => badge('★'.repeat(Math.round(r.rating || 0)) || '—', 'purple'),
        (r) => badge(r.status, r.status === 'approved' ? 'primary' : r.status === 'flagged' ? 'danger' : 'warning'),
      ],
      fields: [
        { label: 'Date', get: (r) => (window.formatDate ? window.formatDate(r.createdAt) : r.createdAt) },
      ],
      extraBody: (r) => (r.comment ? `<p class="mobile-card-subtitle" style="margin-top:8px;white-space:normal;">${esc(String(r.comment).slice(0, 140))}</p>` : ''),
      actions: [
        { icon: 'fa-eye', label: 'Voir', onClick: (r) => window.viewReview && window.viewReview(r._id) },
        { icon: 'fa-check', label: 'Approuver', primary: true, show: (r) => r.status !== 'approved', onClick: (r) => window.approveReview && window.approveReview(r._id) },
        { icon: 'fa-trash', label: 'Supprimer', danger: true, onClick: (r) => window.confirmAction && window.confirmAction('delete', 'review', r._id) },
      ],
      emptyMessage: 'Aucun avis trouvé',
    });
  };

  window.renderRoommatesCardsMobile = function (data) {
    const rows = (data && data.data && data.data.profiles) || [];
    renderMobileCards('roommates-cards', rows, {
      getId: (r) => r._id,
      title: (r) => r.user ? [r.user.firstName, r.user.lastName].filter(Boolean).join(' ') : 'Profil',
      subtitle: (r) => r.location || r.city,
      badges: [(r) => badge(r.status, r.status === 'active' ? 'primary' : 'neutral')],
      fields: [
        { label: 'Université', get: (r) => r.university },
        { label: 'Budget', get: (r) => r.budget ? `${r.budget} MAD` : '' },
        { label: 'Matches', get: (r) => r.matchesCount ?? r.matches },
      ],
      actions: [
        { icon: 'fa-eye', label: 'Voir', onClick: (r) => window.viewRoommateProfile && window.viewRoommateProfile(r._id) },
        { icon: 'fa-trash', label: 'Supprimer', danger: true, onClick: (r) => window.confirmAction && window.confirmAction('delete', 'roommate', r._id) },
      ],
      emptyMessage: 'Aucun profil trouvé',
    });
  };

  window.renderDormContactsCardsMobile = function (data) {
    const rows = (data && data.data && data.data.items) || [];
    const STATUS_LABELS = DC_STATUS_LABELS_REF;
    const STATUS_BADGE = DC_STATUS_BADGE_CLASS_REF;
    const OUTCOME_LABELS = DC_OUTCOME_LABELS_REF;
    const STUDENT_OUTCOME_LABELS = DC_STUDENT_OUTCOME_LABELS_REF;
    const LANDLORD_OUTCOME_LABELS = DC_LANDLORD_OUTCOME_LABELS_REF;
    const METHOD_LABELS = DC_METHOD_LABELS_REF;

    const toneFor = (cls) => (cls === 'active' || cls === 'verified' ? 'primary' : cls === 'urgent' || cls === 'banned' ? 'danger' : cls === 'pending' ? 'warning' : 'neutral');

    renderMobileCards('dc-cards', rows, {
      getId: (r) => r._id,
      cardClass: 'dc-card',
      title: (r) => r.uniqueReference,
      subtitle: (r) => r.listingTitle,
      badges: [
        (r) => badge(STATUS_LABELS[r.status] || r.status, toneFor(STATUS_BADGE[r.status])),
        (r) => badge(OUTCOME_LABELS[r.outcomeStatus] || r.outcomeStatus, r.outcomeStatus === 'rental_confirmed' ? 'primary' : r.outcomeStatus === 'listing_unavailable' ? 'danger' : 'neutral'),
        (r) => {
          const now = Date.now();
          const needsFollowUp = (r.followUpDueAt && !r.followUpSentAt && new Date(r.followUpDueAt).getTime() <= now)
            || (r.reminderDueAt && !r.reminderSentAt && r.followUpSentAt && !r.studentOutcome && new Date(r.reminderDueAt).getTime() <= now);
          return needsFollowUp ? badge('À relancer', 'warning') : '';
        },
      ],
      fields: [
        { label: 'Étudiant', get: (r) => r.student ? `${r.student.firstName || ''} ${r.student.lastName || ''}`.trim() || r.student.email : '—' },
        { label: 'Ville', get: (r) => r.listingCity },
        { label: 'Propriétaire', get: (r) => r.landlordName },
        { label: 'Méthode', get: (r) => METHOD_LABELS[r.contactMethod] || r.contactMethod },
        { label: 'Date', get: (r) => (window.formatDate ? window.formatDate(r.createdAt) : r.createdAt) },
        { label: 'Statut étudiant', get: (r) => STUDENT_OUTCOME_LABELS[r.studentOutcome] },
        { label: 'Statut propriétaire', get: (r) => LANDLORD_OUTCOME_LABELS[r.landlordOutcome] },
      ],
      actions: [
        {
          icon: 'fa-check-double', label: 'Confirmer manuellement', primary: true,
          show: (r) => r.outcomeStatus === 'rental_reported',
          onClick: (r) => window.confirmDormInquiryRental && window.confirmDormInquiryRental(r._id),
        },
      ],
      wireExtra: (row, container) => {
        // Reuse the exact existing inline status <select> element/handler
        // instead of a synthesized one, so updateDormInquiryStatus()'s
        // optimistic-revert-on-failure logic fires identically.
        const card = container.querySelector(`.mobile-card[data-row-id="${CSS.escape(String(row._id))}"]`);
        if (!card || !STATUS_LABELS) return;
        const select = document.createElement('select');
        select.className = 'dc-status-select';
        select.setAttribute('aria-label', 'Modifier le statut');
        select.innerHTML = Object.keys(STATUS_LABELS).map((s) => `<option value="${esc(s)}" ${s === row.status ? 'selected' : ''}>${esc(STATUS_LABELS[s])}</option>`).join('');
        select.addEventListener('change', function () {
          if (typeof window.updateDormInquiryStatus === 'function') window.updateDormInquiryStatus(row._id, this.value, this);
        });
        const actionsEl = card.querySelector('.mobile-card-actions');
        actionsEl?.insertBefore(select, actionsEl.firstChild);
      },
      emptyMessage: 'Aucun contact trouvé',
    });
  };

  // ── Demandes de logement (admin-mediated flow) ──────────────────────────
  const HR_STATUS_LABELS_REF = (typeof HR_STATUS_LABELS !== 'undefined') ? HR_STATUS_LABELS : {};
  const HR_STATUS_BADGE_CLASS_REF = (typeof HR_STATUS_BADGE_CLASS !== 'undefined') ? HR_STATUS_BADGE_CLASS : {};

  window.renderHousingRequestsCardsMobile = function (data) {
    const rows = (data && data.data && data.data.items) || [];
    const toneFor = (cls) => (cls === 'active' || cls === 'verified' ? 'primary' : cls === 'banned' ? 'danger' : cls === 'pending' ? 'warning' : 'neutral');

    renderMobileCards('hr-cards', rows, {
      getId: (r) => r.id,
      title: (r) => r.reference,
      subtitle: (r) => r.listing?.title,
      badges: [
        (r) => badge(HR_STATUS_LABELS_REF[r.mediationStatus] || r.mediationStatus, toneFor(HR_STATUS_BADGE_CLASS_REF[r.mediationStatus])),
        (r) => (r.requester?.isGuest ? badge('Invité', 'neutral') : ''),
        (r) => ((r.mediationNotification?.adminNotifyFailed || r.mediationNotification?.studentNotifyFailed) ? badge('Notification échouée', 'danger') : ''),
      ],
      fields: [
        { label: 'Étudiant(e)', get: (r) => r.requester?.name },
        { label: 'Ville', get: (r) => r.listing?.city },
        { label: 'Date', get: (r) => (window.formatDate ? window.formatDate(r.createdAt) : r.createdAt) },
      ],
      actions: [
        { icon: 'fa-eye', label: 'Détails', primary: true, onClick: (r) => window.viewHousingRequest && window.viewHousingRequest(r.id) },
      ],
      emptyMessage: 'Aucune demande trouvée',
    });
  };

  // ── Property Requests: cosmetic hook only, no logic touched ────────────
  // Its cards are built from inline style="..." strings with no stable
  // class name to target from CSS. Add one shared class to each rendered
  // card root (purely additive, no markup/logic change) so
  // admin-mobile.css has something reliable to hook without rewriting the
  // existing template.
  const prObserverTarget = $('pr-list');
  if (prObserverTarget && 'MutationObserver' in window) {
    const tagCards = () => {
      Array.from(prObserverTarget.children).forEach((el) => el.classList.add('pr-card-mobile'));
    };
    tagCards();
    new MutationObserver(tagCards).observe(prObserverTarget, { childList: true });
  }

  // ── Chart resize on tab switch (additive listener, existing tab
  // buttons keep their own admin.js listener untouched) ──────────────────
  let resizeTimer = null;
  function triggerChartsResizeSoon() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (typeof state === 'undefined' || !state.charts) return;
      Object.values(state.charts).forEach((c) => { try { c.resize(); } catch (e) { /* chart may have been destroyed mid-navigation */ } });
    }, 160);
  }
  function syncCardListVisibility() {
    const mobile = isMobile();
    document.querySelectorAll('.mobile-card-list').forEach((el) => {
      // Only toggle visibility, never touch content - re-fetching isn't
      // needed just because the window was resized.
      if (el.hidden !== !mobile) el.hidden = !mobile;
    });
  }
  window.addEventListener('resize', () => {
    syncCardListVisibility();
    if (isMobile()) triggerChartsResizeSoon();
  });
  window.addEventListener('orientationchange', triggerChartsResizeSoon);
  document.querySelectorAll('.tab-btn[data-tab], .tab-btn[data-settings-tab]').forEach((btn) => {
    btn.addEventListener('click', () => { if (isMobile()) triggerChartsResizeSoon(); });
  });

  // ── Initial sync (in case the dashboard loads directly on a mobile
  // viewport rather than via a navigateToPage() call) ────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof state !== 'undefined' && state.currentPage) window.syncMobileNavMobile(state.currentPage);
  });
})();
