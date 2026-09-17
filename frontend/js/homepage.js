/**
 * RoastMyDorm homepage — search, real listings, favorites, guides.
 * Plain <script src>, no build step, matching the site's existing house
 * style (see frontend/js/dorm-listings.js). Scoped to the new .rmd-home
 * markup only - does not touch nav/auth (those stay in index.html's own
 * inline scripts, untouched by this file).
 */
(function () {
  'use strict';

  const API = ['localhost', '127.0.0.1', ''].includes(window.location.hostname)
    ? 'http://localhost:5000/api' : 'https://www.roastmydorm.com/api';

  const $ = (id) => document.getElementById(id);
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const TYPE_LABELS = { dormitory: 'Résidence', apartment: 'Appartement', studio: 'Studio', shared_room: 'Colocation', private_room: 'Chambre' };

  function relativeConfirmDate(iso) {
    if (!iso) return null;
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days <= 0) return "aujourd'hui";
    if (days === 1) return 'hier';
    if (days < 30) return `il y a ${days} jours`;
    const months = Math.floor(days / 30);
    return `il y a ${months} mois`;
  }

  // Maps a raw /api/dorms document to exactly what the card/overlay need -
  // one place, so the hero overlay and the grid can never disagree about a
  // field. Never invents a confirmation date: verifiedAt is used only when
  // the backend actually set it (see backend/models/Dorm.js).
  function adaptDorm(d) {
    const addr = (d.location && d.location.address) || {};
    const images = d.images || [];
    const cover = images.find((i) => i && i.isPrimary) || images[0];
    return {
      id: d._id,
      slug: d.slug,
      title: d.name,
      type: d.propertyType,
      typeLabel: TYPE_LABELS[d.propertyType] || 'Logement',
      city: addr.city || '',
      neighborhood: addr.neighborhood || '',
      price: (d.pricing && d.pricing.baseRent) || null,
      image: cover ? cover.url : null,
      verifiedAt: (d.verification && d.verification.isVerified && d.verification.verifiedAt) || null,
      createdAt: d.createdAt,
      href: d.slug ? `/logement/${d.slug}` : null,
    };
  }

  // Hero overlay only - the old per-listing grid section was replaced by
  // the city-discovery section below, but the hero's "one real recent
  // listing" preview stays (untouched section, per the task's explicit
  // "preserve the hero" instruction).
  function showHeroOverlaySkeleton() {
    const el = $('rhHeroOverlay');
    if (!el) return;
    el.innerHTML = `
      <div class="rh-skel rh-hero-overlay-thumb" aria-hidden="true"></div>
      <div class="rh-hero-overlay-body">
        <div class="rh-skel rh-hero-overlay-skel-line" style="width:70%;margin-bottom:6px;"></div>
        <div class="rh-skel rh-hero-overlay-skel-line" style="width:90%;margin-bottom:6px;"></div>
        <div class="rh-skel rh-hero-overlay-skel-line" style="width:50%;"></div>
      </div>`;
    el.hidden = false;
  }

  function hideHeroOverlay() {
    const el = $('rhHeroOverlay');
    if (!el) return;
    el.hidden = true;
    el.innerHTML = '';
  }

  async function loadHeroOverlay() {
    showHeroOverlaySkeleton();
    try {
      const res = await fetch(`${API}/dorms?limit=1&sortBy=createdAt&sortOrder=desc`);
      if (!res.ok) { hideHeroOverlay(); return; }
      const data = await res.json();
      const listings = (data.success && Array.isArray(data.data) ? data.data : []).map(adaptDorm);
      if (listings.length) renderHeroOverlay(listings[0]);
      else hideHeroOverlay();
    } catch (e) { hideHeroOverlay(); }
  }

  // Deliberate branded fallback (never an empty grey box) - used both when
  // a listing simply has no photo and when a real photo URL 404s at
  // runtime (the img's onerror below swaps to this exact markup).
  const OVERLAY_THUMB_PLACEHOLDER = '<div class="rh-hero-overlay-thumb rh-hero-overlay-thumb--placeholder" role="img" aria-label="Photo du logement non disponible"><i class="fa-solid fa-house" aria-hidden="true"></i></div>';

  function renderHeroOverlay(listing) {
    const el = $('rhHeroOverlay');
    if (!el || !listing) { hideHeroOverlay(); return; }
    const place = [listing.neighborhood, listing.city].filter(Boolean).join(', ');
    const priceText = listing.price ? `${listing.price.toLocaleString('fr-FR')} MAD/mois` : 'Prix sur demande';
    const altText = `Photo du logement : ${listing.title || 'logement étudiant'}${place ? ', ' + place : ''}`;
    const img = listing.image
      ? `<img class="rh-hero-overlay-thumb" src="${escapeHtml(listing.image)}" alt="${escapeHtml(altText)}" loading="lazy" onerror="this.outerHTML=window.__rmdOverlayPlaceholder;">`
      : OVERLAY_THUMB_PLACEHOLDER;
    window.__rmdOverlayPlaceholder = OVERLAY_THUMB_PLACEHOLDER;
    el.innerHTML = `
      ${img}
      <div class="rh-hero-overlay-body">
        <p class="rh-hero-overlay-title">${escapeHtml(listing.title || 'Logement étudiant')}</p>
        <p class="rh-hero-overlay-meta">${escapeHtml(place)}${place ? ' · ' : ''}<strong>${escapeHtml(priceText)}</strong></p>
        <p class="rh-hero-overlay-confirm">${listing.verifiedAt
          ? `<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Confirmé ${escapeHtml(relativeConfirmDate(listing.verifiedAt))}`
          : `<i class="fa-solid fa-clock" aria-hidden="true"></i> Disponibilité à confirmer`}</p>
      </div>`;
    el.hidden = false;
  }

  // ---- City discovery section ----
  // Real, existing per-city pages only - no invented URLs. Each is already
  // scoped to its one city (see dorm-listings.js's createController({city})
  // on those pages), so a plain link is the real "city filter applied",
  // no query param needed. The Casablanca image is the same one already
  // used site-wide for this exact purpose (previously the homepage's own
  // "for-students-section" city-preview cards, before this section
  // replaced it) - not a new asset.
  const CITIES = [
    { key: 'casablanca', name: 'Casablanca', href: 'casablanca-dorms.html', image: 'Casablanca%20%F0%9F%87%B2%F0%9F%87%A6.webp', featured: true, promoted: true },
    { key: 'rabat', name: 'Rabat', href: 'rabat-dorms.html', image: 'Rabat.webp' },
    { key: 'marrakech', name: 'Marrakech', href: 'marrakech-dorms.html', image: 'marrakeech.webp' },
    { key: 'settat', name: 'Settat', href: 'settat-logement.html', image: 'settat.webp' },
  ];

  // One request per city, each already sorted cheapest-first with limit=1 -
  // returns the real total count (pagination.total) AND the real minimum
  // price (data[0].pricing.baseRent) in a single round trip, with no new
  // backend endpoint or aggregate needed.
  async function fetchCityStats(cityKey) {
    try {
      const res = await fetch(`${API}/dorms?city=${encodeURIComponent(cityKey)}&limit=1&sortBy=pricing.baseRent&sortOrder=asc`);
      if (!res.ok) return { count: 0, minPrice: null };
      const data = await res.json();
      const count = (data.pagination && typeof data.pagination.total === 'number') ? data.pagination.total : 0;
      const first = data.success && Array.isArray(data.data) ? data.data[0] : null;
      const minPrice = (first && first.pricing && typeof first.pricing.baseRent === 'number' && first.pricing.baseRent > 0)
        ? first.pricing.baseRent : null;
      return { count, minPrice };
    } catch (e) {
      return { count: 0, minPrice: null };
    }
  }

  function cityDesktopCardHtml(city, stats) {
    const countText = stats.count > 0
      ? (stats.count === 1 ? '1 logement publié' : `${stats.count} logements publiés`)
      : 'Aucune annonce publiée pour le moment';
    const priceHtml = stats.minPrice
      ? `<p class="rh-city-card-price">À partir de ${stats.minPrice.toLocaleString('fr-FR')} MAD/mois</p>`
      : '';
    return `
      <a class="rh-city-card${city.featured ? ' rh-city-card--featured' : ''}" href="${escapeHtml(city.href)}" aria-label="Voir les logements à ${escapeHtml(city.name)}">
        <img src="${city.image}" alt="Vue de ${escapeHtml(city.name)}, ville universitaire au Maroc" loading="${city.featured ? 'eager' : 'lazy'}" decoding="async">
        <div class="rh-city-card-overlay"></div>
        <div class="rh-city-card-body">
          <h3 class="rh-city-card-name">${escapeHtml(city.name)}</h3>
          <p class="rh-city-card-count">${countText}</p>
          ${priceHtml}
          <span class="rh-city-card-cta">Voir les logements <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>
        </div>
      </a>`;
  }

  function cityMobileCardHtml(city) {
    return `
      <a class="rh-city-card-mobile${city.promoted ? ' rh-city-card-mobile--promoted' : ''}" href="${escapeHtml(city.href)}" aria-label="Voir les logements à ${escapeHtml(city.name)}">
        <img src="${city.image}" alt="Vue de ${escapeHtml(city.name)}, ville universitaire au Maroc" loading="lazy" decoding="async">
        <span class="rh-city-card-mobile-label">${escapeHtml(city.name)}</span>
      </a>`;
  }

  async function loadCities() {
    const desktopGrid = $('rhCityGridDesktop');
    const mobileGrid = $('rhCityGridMobile');
    if (!desktopGrid && !mobileGrid) return;

    if (mobileGrid) mobileGrid.innerHTML = CITIES.map(cityMobileCardHtml).join('');

    try {
      const statsList = await Promise.all(CITIES.map((c) => fetchCityStats(c.key)));
      if (desktopGrid) {
        desktopGrid.innerHTML = CITIES.map((c, i) => cityDesktopCardHtml(c, statsList[i])).join('');
      }
    } catch (e) {
      if (desktopGrid) {
        desktopGrid.innerHTML = CITIES.map((c) => cityDesktopCardHtml(c, { count: 0, minPrice: null })).join('');
      }
    }
  }

  // ---- Guides: prefers real published /api/blog/recent posts (currently
  // none exist in production); falls back to these 3 real, already-live
  // static guide pages (verified: title/meta match exactly) rather than a
  // generic "coming soon" state, since real content already exists here -
  // it just isn't in the backend blog collection.
  const FALLBACK_GUIDES = [
    { title: 'Guide Logement Étudiant à Rabat 2026', excerpt: 'Meilleurs quartiers, prix par zone, astuces colocation et pièges à éviter.', href: 'guide-logement-rabat.html' },
    { title: 'Guide Logement Étudiant à Casablanca 2026', excerpt: 'Meilleurs quartiers (Maarif, Bourgogne, Ain Sebaa), prix, astuces colocation et arnaques à éviter.', href: 'guide-logement-casablanca.html' },
    { title: 'Guide Logement Étudiant à Marrakech 2026', excerpt: 'Meilleurs quartiers (Gueliz, Saada, Targa, Dyour Marjane), prix, astuces colocation et arnaques à éviter.', href: 'guide-logement-marrakech.html' },
  ];

  async function loadGuides() {
    const grid = $('rhGuidesGrid');
    if (!grid) return;
    const renderFallback = () => {
      grid.innerHTML = FALLBACK_GUIDES.map((g) => `
        <a class="rh-guide-card" href="${escapeHtml(g.href)}">
          <h3>${escapeHtml(g.title)}</h3>
          <p>${escapeHtml(g.excerpt)}</p>
        </a>`).join('');
    };
    try {
      const res = await fetch(`${API}/blog/recent?limit=3`);
      const data = await res.json().catch(() => null);
      const posts = data && data.success && Array.isArray(data.data) ? data.data : [];
      if (!posts.length) { renderFallback(); return; }
      grid.innerHTML = posts.map((p) => `
        <a class="rh-guide-card" href="blog.html">
          <h3>${escapeHtml(p.title)}</h3>
          <p>${escapeHtml(p.excerpt || '')}</p>
        </a>`).join('');
    } catch (e) {
      renderFallback();
    }
  }

  // ---- Search: real cities/universities only, redirects to the real
  // existing per-city page (each already reads ?maxPrice= via
  // dorm-listings.js's readFiltersFromURL). Never a dead link.
  const CITY_ROUTES = {
    casablanca: 'casablanca-dorms.html',
    rabat: 'rabat-dorms.html',
    marrakech: 'marrakech-dorms.html',
    marrakesh: 'marrakech-dorms.html',
    settat: 'settat-logement.html',
  };
  const UNIVERSITY_ROUTES = {
    'mohammed v': 'housing-near-mohammed-v-university.html',
    'um5': 'housing-near-mohammed-v-university.html',
    'uir': 'housing-near-uir.html',
    'ensias': 'housing-near-ensias.html',
    'emsi': 'housing-near-emsi.html',
    'encg casablanca': 'housing-near-encg-casablanca.html',
    'encg': 'housing-near-encg-casablanca.html',
    'ispits': 'housing-near-ispits.html',
    'cadi ayyad': 'housing-near-cadi-ayyad-university.html',
    'uca': 'housing-near-cadi-ayyad-university.html',
    'upm': 'housing-near-upm.html',
    'um6p': 'housing-near-um6p.html',
  };
  function normalize(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }
  function resolveDestination(query) {
    const q = normalize(query);
    if (!q) return null;
    for (const key in CITY_ROUTES) { if (q.indexOf(key) !== -1) return CITY_ROUTES[key]; }
    for (const key in UNIVERSITY_ROUTES) { if (q.indexOf(key) !== -1) return UNIVERSITY_ROUTES[key]; }
    return null;
  }

  function wireSearch() {
    const form = $('rhSearchForm');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const query = $('rhSearchCity').value;
      const budget = $('rhSearchBudget').value;
      const errorEl = $('rhSearchError');
      const dest = resolveDestination(query);
      if (!dest) {
        if (errorEl) {
          errorEl.textContent = query.trim()
            ? "Ville ou université non reconnue. Essaie Casablanca, Rabat, Marrakech ou Settat, ou le nom de ton université."
            : "Indique une ville ou une université pour lancer la recherche.";
          errorEl.classList.add('show');
        }
        return;
      }
      if (errorEl) errorEl.classList.remove('show');
      const url = budget ? `${dest}?maxPrice=${encodeURIComponent(budget)}` : dest;
      window.location.href = url;
    });
  }

  // lang-switcher.js (loaded before this file, shared across every page)
  // always injects its toggle inside .nav-menu - fine on desktop where
  // .nav-menu is the visible inline row, but on mobile .nav-menu is the
  // closed dropdown (display:none until the hamburger opens it), which is
  // exactly why the language selector was invisible in the persistent
  // mobile header. This moves the SAME node (its click handlers untouched)
  // to be a direct sibling of the hamburger instead of a descendant of the
  // dropdown - zero changes to lang-switcher.js itself, so language
  // behavior on every other page is unaffected.
  // Scoped to <768px only - the task this shipped under is explicit that
  // nothing above that width may change, so the >=768px dropdown/inline
  // behavior (already working, not part of this task) is left exactly as
  // lang-switcher.js originally built it.
  const MOBILE_QUERY = '(max-width: 767.98px)';
  function relocateLangSwitcher() {
    const langWrapper = $('rmd-lang-wrapper');
    const hamburger = $('hamburger');
    const navMenu = $('navMenu');
    if (!langWrapper || !hamburger || !hamburger.parentElement || !navMenu) return;
    if (window.matchMedia(MOBILE_QUERY).matches) {
      if (langWrapper.nextElementSibling !== hamburger) hamburger.parentElement.insertBefore(langWrapper, hamburger);
    } else if (langWrapper.parentElement !== navMenu) {
      navMenu.appendChild(langWrapper);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    relocateLangSwitcher();
    window.matchMedia(MOBILE_QUERY).addEventListener('change', relocateLangSwitcher);
    wireSearch();
    loadHeroOverlay();
    loadCities();
    loadGuides();
  });
})();
