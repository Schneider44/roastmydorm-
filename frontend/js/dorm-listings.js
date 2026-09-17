/**
 * RoastMyDorm — shared listing search / filter / render module.
 *
 * Replaces the four near-identical (and mutually-clobbering) copies of
 * renderListings() / filterListings() / setupRechercher() / typeMatchesFilter()
 * that lived inline in casablanca-dorms.html, rabat-dorms.html,
 * marrakech-dorms.html and settat-logement.html.
 *
 * The bug this fixes: the tag filter and the free-text search were two
 * separate code paths that each re-filtered from the FULL unfiltered array and
 * re-rendered, so each one silently discarded whatever the other had applied.
 * Price was never compared at all, accents/case were never normalized, and the
 * type matcher didn't know the real backend `propertyType` enum values
 * (dormitory / shared_room / private_room), so API-sourced listings vanished
 * whenever a type filter was active.
 *
 * Everything now goes through ONE predicate — matchesFilters() — fed by ONE
 * filters state object owned by createController(). There is no second path.
 *
 * Plain <script src> file, no modules / no build step, matching the house
 * style of js/rmd-shared.js. Exposes window.RMD_LISTINGS.
 */
(function () {
  'use strict';

  /* ============================================================
     Text / value normalization
     ============================================================ */

  // Lowercase, accent-strip, collapse whitespace. Used for EVERY text
  // comparison so "Maârif", "MAARIF" and " maarif " all compare equal.
  function normalizeText(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  // The 5 canonical property types + their French display labels.
  const PROPERTY_TYPES = {
    studio: 'Studio',
    private_room: 'Chambre',
    shared_room: 'Colocation',
    apartment: 'Appartement',
    dorm: 'Résidence étudiante',
  };

  // Every messy legacy value found in the four static arrays, PLUS the real
  // backend Dorm.propertyType enum (dormitory / apartment / studio /
  // shared_room / private_room). Anything unrecognized returns null so it can
  // never accidentally satisfy a type filter.
  const TYPE_ALIASES = {
    // studio
    'studio': 'studio',
    'studios': 'studio',
    // colocation / shared
    'shared': 'shared_room',
    'shared room': 'shared_room',
    'shared_room': 'shared_room',
    'sharing': 'shared_room',
    'partage': 'shared_room',      // "Partagé" after accent-strip
    'partagerd': 'shared_room',
    'partagee': 'shared_room',
    'colocation': 'shared_room',
    'coloc': 'shared_room',
    'roomate': 'shared_room',
    'roommate': 'shared_room',
    // chambre / private room
    'room': 'private_room',
    'rooms': 'private_room',
    'chambre': 'private_room',
    'private room': 'private_room',
    'private_room': 'private_room',
    // appartement
    'apartment': 'apartment',
    'apartement': 'apartment',
    'appartement': 'apartment',
    'apt': 'apartment',
    'flat': 'apartment',
    // résidence étudiante
    'dorm': 'dorm',
    'dormitory': 'dorm',
    'residence': 'dorm',
    'residence etudiante': 'dorm',
  };

  function normalizePropertyType(raw) {
    const key = normalizeText(raw);
    if (!key) return null;
    return TYPE_ALIASES[key] || null;
  }

  function propertyTypeLabel(canonical) {
    return PROPERTY_TYPES[canonical] || '';
  }

  // Numbers stay numbers; "2500 MAD" / "2,500" / "2 500" become 2500.
  // Anything uncoercible becomes NaN (callers treat NaN as "no price").
  function parsePrice(raw) {
    if (typeof raw === 'number') return isFinite(raw) ? raw : NaN;
    if (raw === null || raw === undefined) return NaN;
    const cleaned = String(raw).replace(/[\s  ,]/g, '').replace(/[^0-9.]/g, '');
    if (!cleaned) return NaN;
    const n = parseFloat(cleaned);
    return isFinite(n) ? n : NaN;
  }

  function formatPriceMAD(n) {
    const v = parsePrice(n);
    if (isNaN(v)) return 'Prix sur demande';
    return v.toLocaleString('fr-FR') + ' MAD / mois';
  }

  /* ============================================================
     The single filter predicate
     ============================================================ */

  // Every check short-circuits to "pass" when its filter field is empty, so
  // only the filters the user actually set constrain the results. All checks
  // are AND-combined.
  function matchesFilters(listing, filters) {
    if (!listing) return false;
    const f = filters || {};

    // City
    if (f.city) {
      if (normalizeText(listing.city) !== normalizeText(f.city)) return false;
    }

    // Neighborhood
    if (f.neighborhood) {
      if (normalizeText(listing.neighborhood) !== normalizeText(f.neighborhood)) return false;
    }

    // Price range
    const price = parsePrice(listing.price);
    const min = parsePrice(f.minPrice);
    const max = parsePrice(f.maxPrice);
    if (!isNaN(min)) {
      if (isNaN(price) || price < min) return false;
    }
    if (!isNaN(max)) {
      if (isNaN(price) || price > max) return false;
    }

    // Property type (canonical on both sides)
    if (f.type) {
      const wanted = normalizePropertyType(f.type) || normalizeText(f.type);
      const actual = normalizePropertyType(listing.type);
      if (!actual || actual !== wanted) return false;
    }

    // Furnished — 'yes' / 'no' (listing.furnished is a tri-state boolean)
    if (f.furnished) {
      if (f.furnished === 'yes' && listing.furnished !== true) return false;
      if (f.furnished === 'no' && listing.furnished !== false) return false;
    }

    // Availability — 'available' / 'unavailable'
    if (f.availability) {
      const isAvailable = listing.available !== false;
      if (f.availability === 'available' && !isAvailable) return false;
      if (f.availability === 'unavailable' && isAvailable) return false;
    }

    // Verified — 'yes' only (a "show unverified" toggle isn't a real user need)
    if (f.verified === 'yes' && listing.verified !== true) return false;

    // Free-text keyword: substring, accent/case-insensitive, across every
    // text field a student might plausibly type — including the price, which
    // the old search never looked at at all.
    if (f.keyword) {
      const q = normalizeText(f.keyword);
      if (q) {
        const haystack = normalizeText([
          listing.title,
          listing.city,
          listing.neighborhood,
          listing.address,
          listing.location,
          listing.university,
          listing.type,
          propertyTypeLabel(normalizePropertyType(listing.type)),
          isNaN(price) ? '' : String(price),
        ].filter(Boolean).join(' '));
        if (haystack.indexOf(q) === -1) return false;
      }
    }

    return true;
  }

  function applyFilters(listings, filters) {
    if (!Array.isArray(listings)) return [];
    return listings.filter(function (l) { return matchesFilters(l, filters); });
  }

  // Unique neighborhoods actually present in the data for a city. Deduped
  // case/accent-insensitively but returned in their most common display
  // spelling, so the dropdown can never drift out of sync with the listings.
  function getNeighborhoodsForCity(listings, city) {
    const buckets = Object.create(null);
    (listings || []).forEach(function (l) {
      if (!l || !l.neighborhood) return;
      if (city && normalizeText(l.city) !== normalizeText(city)) return;
      const key = normalizeText(l.neighborhood);
      if (!key) return;
      if (!buckets[key]) buckets[key] = Object.create(null);
      const display = String(l.neighborhood).trim();
      buckets[key][display] = (buckets[key][display] || 0) + 1;
    });
    return Object.keys(buckets).map(function (key) {
      const variants = buckets[key];
      return Object.keys(variants).sort(function (a, b) { return variants[b] - variants[a]; })[0];
    }).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
  }

  /* ============================================================
     URL sync
     ============================================================ */

  const URL_KEYS = {
    city: 'city',
    neighborhood: 'neighborhood',
    type: 'type',
    minPrice: 'minPrice',
    maxPrice: 'maxPrice',
    furnished: 'furnished',
    availability: 'availability',
    verified: 'verified',
    keyword: 'q',
  };

  function readFiltersFromURL(search) {
    const params = new URLSearchParams(
      typeof search === 'string' ? search : (window.location.search || '')
    );
    const filters = {};
    Object.keys(URL_KEYS).forEach(function (stateKey) {
      const v = params.get(URL_KEYS[stateKey]);
      if (v !== null && v !== '') filters[stateKey] = v;
    });
    return filters;
  }

  function filtersToQueryString(filters) {
    const params = new URLSearchParams();
    Object.keys(URL_KEYS).forEach(function (stateKey) {
      const v = filters ? filters[stateKey] : null;
      if (v !== undefined && v !== null && String(v) !== '') {
        params.set(URL_KEYS[stateKey], String(v));
      }
    });
    return params.toString();
  }

  // replaceState (not pushState) so live filtering doesn't push one history
  // entry per keystroke. Guarded because file:// origins can reject it.
  function writeFiltersToURL(filters) {
    const qs = filtersToQueryString(filters);
    const url = window.location.pathname + (qs ? '?' + qs : '') + (window.location.hash || '');
    try {
      window.history.replaceState(null, '', url);
    } catch (e) { /* opaque origin (file://) — filtering still works */ }
  }

  /* ============================================================
     Small utilities
     ============================================================ */

  function debounce(fn, ms) {
    let t = null;
    return function () {
      const args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms || 300);
    };
  }

  function escapeHtml(str) {
    return String(str === null || str === undefined ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Swap to a placeholder once, via a real listener: production's CSP is
  // helmet with scriptSrc:["'self'"] and no 'unsafe-inline', which silently
  // no-ops inline onerror= attributes.
  function wireImageFallback(imgEl, fallbackSrc) {
    if (!imgEl || !fallbackSrc || imgEl.dataset.fallbackWired) return;
    imgEl.dataset.fallbackWired = '1';
    imgEl.addEventListener('error', function onErr() {
      imgEl.removeEventListener('error', onErr);
      imgEl.src = fallbackSrc;
      imgEl.classList.add('rmd-fallback-active');
    });
  }

  const FALLBACK_IMAGE = 'roastmydorm_logo-removebg-preview.webp';

  // Honest "not built yet" affordance for UI elements (map view, etc.) that
  // are visually present per the design but have no real backend behind
  // them — same pattern as the roommate pages' feature-flagged notification
  // button: visible, but never pretends to do something it can't.
  function showComingSoonToast(message) {
    document.querySelectorAll('.rmd-toast').forEach(function (el) { el.remove(); });
    const el = document.createElement('div');
    el.className = 'rmd-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<i class="fa-solid fa-circle-info" aria-hidden="true"></i> ' + escapeHtml(message || 'Bientôt disponible');
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
  }

  function wireImageFallbacks(root) {
    (root || document).querySelectorAll('img[data-fallback-src]').forEach(function (img) {
      wireImageFallback(img, img.dataset.fallbackSrc);
      // An <img> whose src already failed before this ran won't fire `error`
      // again, so catch that case explicitly.
      if (img.complete && img.naturalWidth === 0 && img.src !== img.dataset.fallbackSrc) {
        img.src = img.dataset.fallbackSrc;
        img.classList.add('rmd-fallback-active');
      }
    });
  }

  const AMENITY_ICONS = {
    'wifi': 'fa-wifi', 'wi-fi': 'fa-wifi', 'wi-fi&landry': 'fa-wifi',
    'gym': 'fa-dumbbell', 'laundry': 'fa-water', 'parking': 'fa-square-parking',
    'quiet': 'fa-volume-xmark', 'calme': 'fa-volume-xmark',
    'meuble': 'fa-couch', 'furnished': 'fa-couch', 'empty': 'fa-box-open',
  };
  const AMENITY_LABELS = {
    'wifi': 'Wi-Fi', 'wi-fi': 'Wi-Fi', 'wi-fi&landry': 'Wi-Fi & laverie',
    'gym': 'Salle de sport', 'laundry': 'Laverie', 'parking': 'Parking',
    'quiet': 'Calme', 'calme': 'Calme', 'meuble': 'Meublé',
    'furnished': 'Meublé', 'empty': 'Non meublé',
  };
  function amenityLabel(a) {
    const key = normalizeText(a);
    if (AMENITY_LABELS[key]) return AMENITY_LABELS[key];
    return String(a).trim().replace(/^./, function (c) { return c.toUpperCase(); });
  }
  function amenityIcon(a) {
    return AMENITY_ICONS[normalizeText(a)] || 'fa-circle-check';
  }

  // Best-effort tri-state: true / false / undefined ("not stated").
  function inferFurnished(listing) {
    const text = normalizeText([(listing.amenities || []).join(' '), listing.title].join(' '));
    if (/\bnon meuble|\bnot furnished|\bunfurnished|\bempty\b/.test(text)) return false;
    if (/meuble|furnished/.test(text)) return true;
    return undefined;
  }

  /* ============================================================
     Rendering
     ============================================================ */

  function renderSkeletons(container, count) {
    if (!container) return;
    let html = '';
    for (let i = 0; i < (count || 6); i++) {
      html += '<div class="rmd-skeleton rmd-listing-skeleton" aria-hidden="true"></div>';
    }
    container.innerHTML = html;
  }

  const TYPE_ICONS = {
    studio: 'fa-door-open', private_room: 'fa-bed', shared_room: 'fa-people-roof',
    apartment: 'fa-building', dorm: 'fa-hotel',
  };

  function renderListingCard(listing, options) {
    const opts = options || {};
    const id = String(listing.id);
    const canonicalType = normalizePropertyType(listing.type);
    const typeLabel = propertyTypeLabel(canonicalType);
    const typeIcon = TYPE_ICONS[canonicalType] || 'fa-house';
    const place = [listing.neighborhood, listing.city].filter(Boolean).join(', ') || listing.location || '';
    const available = listing.available !== false;
    const image = listing.image || FALLBACK_IMAGE;
    const href = listing.href || '';
    const ctaText = available ? 'Voir le logement' : "Rejoindre la liste d'attente";
    const cta = href
      ? '<a class="btn btn-primary rmd-listing-card-cta" href="' + escapeHtml(href) + '">' + ctaText + ' <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a>'
      : '<button type="button" class="btn btn-primary rmd-listing-card-cta" data-open-id="' + escapeHtml(id) + '">' + ctaText + ' <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>';

    // Up to 3 feature chips: furnished + availability first (the two facts a
    // student scans for fastest), then real amenities filling any remaining
    // slots. Never padded with placeholders.
    const chipDefs = [];
    if (listing.furnished === true) chipDefs.push({ icon: 'fa-couch', label: 'Meublé' });
    else if (listing.furnished === false) chipDefs.push({ icon: 'fa-box-open', label: 'Non meublé' });
    chipDefs.push({ icon: available ? 'fa-circle' : 'fa-circle-xmark', label: available ? 'Disponible' : 'Indisponible', state: available ? 'is-available' : 'is-unavailable' });
    // Skip amenities already implied by the furnished chip above (e.g. a raw
    // "Meublé"/"Empty" amenity string) so the same fact never shows twice.
    (listing.amenities || []).forEach(function (a) {
      if (chipDefs.length >= 3) return;
      const key = normalizeText(a);
      if (key === 'meuble' || key === 'furnished' || key === 'empty') return;
      chipDefs.push({ icon: amenityIcon(a), label: amenityLabel(a) });
    });
    const chips = chipDefs.slice(0, 3).map(function (c) {
      return '<li class="rmd-listing-chip' + (c.state ? ' ' + c.state : '') + '">' +
        '<i class="fa-solid ' + c.icon + '" aria-hidden="true"></i>' + escapeHtml(c.label) + '</li>';
    }).join('');

    return '' +
      '<article class="rmd-listing-card" data-listing-id="' + escapeHtml(id) + '">' +
        '<div class="rmd-listing-card-media">' +
          '<img class="rmd-listing-card-img" src="' + escapeHtml(image) + '" alt="' + escapeHtml(listing.title || 'Logement') + '"' +
            ' loading="lazy" decoding="async" data-fallback-src="' + escapeHtml(FALLBACK_IMAGE) + '">' +
          '<button type="button" class="rmd-listing-fav" data-fav-id="' + escapeHtml(id) + '"' +
            ' aria-pressed="' + (opts.isSaved ? 'true' : 'false') + '"' +
            ' aria-label="' + (opts.isSaved ? 'Retirer des favoris' : 'Sauvegarder ce logement') + '">' +
            '<i class="fa-' + (opts.isSaved ? 'solid' : 'regular') + ' fa-heart" aria-hidden="true"></i></button>' +
          (listing.verified ? '<span class="badge-pill rmd-listing-card-verified"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> Vérifié</span>' : '') +
          (typeLabel ? '<span class="rmd-listing-card-type-badge"><i class="fa-solid ' + typeIcon + '" aria-hidden="true"></i> ' + escapeHtml(typeLabel) + '</span>' : '') +
        '</div>' +
        '<div class="rmd-listing-card-body">' +
          '<h3 class="rmd-listing-card-title">' + escapeHtml(listing.title || '') + '</h3>' +
          (place ? '<p class="rmd-listing-card-place"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ' + escapeHtml(place) + '</p>' : '') +
          '<p class="rmd-listing-card-price">' + escapeHtml(formatPriceMAD(listing.price).replace(' / mois', '')) + ' <span>/ mois</span></p>' +
          (chips ? '<ul class="rmd-listing-card-chips">' + chips + '</ul>' : '') +
          cta +
        '</div>' +
      '</article>';
  }

  const FILTER_CHIP_LABELS = {
    neighborhood: 'Quartier',
    type: 'Type',
    minPrice: 'Prix min',
    maxPrice: 'Prix max',
    furnished: 'Ameublement',
    availability: 'Disponibilité',
    verified: 'Vérifié',
    keyword: 'Recherche',
  };
  const FILTER_VALUE_LABELS = {
    furnished: { yes: 'Meublé', no: 'Non meublé' },
    availability: { available: 'Disponible', unavailable: 'Indisponible' },
    verified: { yes: 'Vérifié' },
  };
  function chipValueLabel(key, value) {
    if (key === 'type') return propertyTypeLabel(normalizePropertyType(value)) || value;
    if (FILTER_VALUE_LABELS[key] && FILTER_VALUE_LABELS[key][value]) return FILTER_VALUE_LABELS[key][value];
    if (key === 'minPrice' || key === 'maxPrice') return value + ' MAD';
    return value;
  }

  const SORT_OPTIONS = [
    { value: 'recent', label: 'Plus récent' },
    { value: 'price_asc', label: 'Prix croissant' },
    { value: 'price_desc', label: 'Prix décroissant' },
  ];

  function renderResultsHeader(container, config) {
    if (!container) return;
    const cfg = config || {};
    const filters = cfg.filters || {};
    const count = cfg.count || 0;
    const chips = Object.keys(FILTER_CHIP_LABELS).filter(function (k) {
      return filters[k] !== undefined && filters[k] !== null && String(filters[k]) !== '';
    }).map(function (k) {
      return '<button type="button" class="filter-chip rmd-active-filter-chip" data-remove-filter="' + k + '">' +
        '<span>' + escapeHtml(FILTER_CHIP_LABELS[k] + ' : ' + chipValueLabel(k, filters[k])) + '</span>' +
        '<span aria-hidden="true">&times;</span>' +
        '<span class="rmd-sr-only">Retirer le filtre ' + escapeHtml(FILTER_CHIP_LABELS[k]) + '</span>' +
        '</button>';
    }).join('');

    // The city chip is informational on these single-city pages (not a real
    // multi-city switcher) — clicking it goes to "explore other cities"
    // rather than pretending to remove the city scope of this page.
    const cityChip = cfg.cityLabel
      ? '<button type="button" class="filter-chip rmd-active-filter-chip rmd-city-chip" data-view-all-cities>' +
          '<span>' + escapeHtml(cfg.cityLabel) + '</span><span aria-hidden="true">&times;</span>' +
        '</button>'
      : '';

    const sortValue = cfg.sort || 'recent';
    const options = SORT_OPTIONS.map(function (o) {
      return '<option value="' + o.value + '"' + (o.value === sortValue ? ' selected' : '') + '>' + o.label + '</option>';
    }).join('');

    container.innerHTML = '' +
      '<div class="rmd-results-head">' +
        '<p class="rmd-results-count" role="status" aria-live="polite">' +
          (count === 0 ? 'Aucun logement' : count === 1 ? '1 logement trouvé' : count + ' logements trouvés') +
        '</p>' +
        '<div class="rmd-results-actions">' +
          '<div class="rmd-results-sort">' +
            '<label for="rmdSortSelect" class="rmd-sr-only">Trier par</label>' +
            '<select id="rmdSortSelect" class="rmd-select rmd-sort-select">' + options + '</select>' +
          '</div>' +
          '<button type="button" class="btn btn-secondary rmd-map-btn" id="rmdViewMapBtn">' +
            '<i class="fa-regular fa-map" aria-hidden="true"></i> <span>Voir la carte</span></button>' +
        '</div>' +
      '</div>' +
      ((chips || cityChip) ? '<div class="rmd-active-filters" aria-label="Filtres actifs">' + cityChip + chips + '</div>' : '');

    if (typeof cfg.onRemoveFilter === 'function') {
      container.querySelectorAll('[data-remove-filter]').forEach(function (btn) {
        btn.addEventListener('click', function () { cfg.onRemoveFilter(btn.dataset.removeFilter); });
      });
    }
    if (typeof cfg.onSortChange === 'function') {
      const sel = container.querySelector('#rmdSortSelect');
      if (sel) sel.addEventListener('change', function () { cfg.onSortChange(sel.value); });
    }
    const mapBtn = container.querySelector('#rmdViewMapBtn');
    if (mapBtn) mapBtn.addEventListener('click', function () {
      showComingSoonToast('Vue carte bientôt disponible');
    });
    const cityChipBtn = container.querySelector('[data-view-all-cities]');
    if (cityChipBtn && typeof cfg.onViewAllCities === 'function') {
      cityChipBtn.addEventListener('click', cfg.onViewAllCities);
    }
  }

  function stateHtml(icon, heading, body, buttons) {
    return '<div class="rmd-state rmd-listing-state">' +
      '<i class="fa-solid ' + icon + ' state-icon" aria-hidden="true"></i>' +
      '<h3>' + heading + '</h3>' +
      (body ? '<p>' + body + '</p>' : '') +
      (buttons ? '<div class="rmd-state-actions">' + buttons + '</div>' : '') +
      '</div>';
  }

  function renderNoResults(container, config) {
    if (!container) return;
    const cfg = config || {};
    container.innerHTML = stateHtml(
      'fa-magnifying-glass',
      'Aucun logement ne correspond à vos critères',
      'Essayez d’élargir votre budget ou de sélectionner un autre quartier.',
      '<button type="button" class="btn btn-primary" data-action="reset">Réinitialiser les filtres</button>' +
      '<button type="button" class="btn btn-secondary" data-action="view-all">Voir tous les logements</button>'
    );
    const reset = container.querySelector('[data-action="reset"]');
    const viewAll = container.querySelector('[data-action="view-all"]');
    if (reset && typeof cfg.onReset === 'function') reset.addEventListener('click', cfg.onReset);
    if (viewAll && typeof cfg.onViewAll === 'function') viewAll.addEventListener('click', cfg.onViewAll);
  }

  // Deliberately renders an "Activer une alerte" action ONLY when an
  // onEnableAlert callback is supplied — there is no backend alert endpoint,
  // and the page must never claim an alert was created.
  function renderNoInventory(container, config) {
    if (!container) return;
    const cfg = config || {};
    let buttons = '';
    if (typeof cfg.onExploreOther === 'function') {
      buttons += '<button type="button" class="btn btn-primary" data-action="explore">Explorer d’autres villes</button>';
    }
    if (typeof cfg.onContact === 'function') {
      buttons += '<button type="button" class="btn btn-secondary" data-action="contact">Nous contacter</button>';
    }
    if (typeof cfg.onEnableAlert === 'function') {
      buttons += '<button type="button" class="btn btn-secondary" data-action="alert">Activer une alerte</button>';
    }
    container.innerHTML = stateHtml(
      'fa-house-circle-xmark',
      'Aucun logement disponible à ' + escapeHtml(cfg.city || '') + ' pour le moment.',
      '',
      buttons
    );
    const bind = function (sel, fn) {
      const el = container.querySelector(sel);
      if (el && typeof fn === 'function') el.addEventListener('click', fn);
    };
    bind('[data-action="explore"]', cfg.onExploreOther);
    bind('[data-action="contact"]', cfg.onContact);
    bind('[data-action="alert"]', cfg.onEnableAlert);
  }

  // Compact, dismissible inline warning — NOT a full-page error. The optional
  // API merge failing must never dominate the page or hide the (still
  // rendered) static listings; a big red banner would misrepresent a
  // graceful-degradation case as a hard failure.
  function renderError(container, config) {
    if (!container) return;
    const cfg = config || {};
    container.innerHTML = '<div class="rmd-listing-warning" role="status">' +
      '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>' +
      '<p>' + escapeHtml(cfg.message || 'Certaines nouvelles annonces n’ont pas pu être chargées. Les logements disponibles restent affichés.') + '</p>' +
      '<button type="button" class="btn-link" data-action="retry">Réessayer</button>' +
      '<button type="button" class="rmd-listing-warning-dismiss" data-action="dismiss" aria-label="Fermer">&times;</button>' +
      '</div>';
    const btn = container.querySelector('[data-action="retry"]');
    if (btn && typeof cfg.onRetry === 'function') btn.addEventListener('click', cfg.onRetry);
    const dismiss = container.querySelector('[data-action="dismiss"]');
    if (dismiss) dismiss.addEventListener('click', function () { container.innerHTML = ''; });
  }

  function sortListings(listings, sort) {
    const arr = listings.slice();
    if (sort === 'price_asc' || sort === 'price_desc') {
      const dir = sort === 'price_asc' ? 1 : -1;
      arr.sort(function (a, b) {
        const pa = parsePrice(a.price), pb = parsePrice(b.price);
        if (isNaN(pa) && isNaN(pb)) return 0;
        if (isNaN(pa)) return 1;
        if (isNaN(pb)) return -1;
        return (pa - pb) * dir;
      });
    }
    // 'recent' keeps the caller's own ordering (API listings first, then the
    // static array which is already sorted newest-id-first).
    return arr;
  }

  /* ============================================================
     Page controller — owns the single filters state object
     ============================================================ */

  // Singular elements (exactly one instance expected — grid, sheet, etc.)
  // are still looked up by id. Filter CONTROLS are looked up by
  // data-rmd-filter/data-rmd-toggle attributes via querySelectorAll instead,
  // because the desktop search panel and the mobile/advanced sheet each need
  // their OWN Quartier/Prix/Type controls (can't share one id when both are
  // simultaneously in the DOM) while staying perfectly in sync — every
  // matching control is read/written/wired together as one group.
  const EL = {
    form: 'listingFilters',
    reset: 'filterResetBtn',
    sheet: 'filterSheet',
    backdrop: 'filterSheetBackdrop',
    sheetClose: 'filterSheetClose',
    sheetApply: 'filterSheetApply',
    sheetReset: 'filterSheetReset',
    results: 'resultsHeader',
    grid: 'listingsGrid',
    mergeError: 'mergeError',
    count: 'listingCount',
  };
  function $(key) { return document.getElementById(EL[key]); }
  function $$(attr, value) { return Array.prototype.slice.call(document.querySelectorAll('[' + attr + '="' + value + '"]')); }

  function createController(options) {
    const opts = options || {};
    const city = opts.city || '';
    let baseListings = (opts.listings || []).slice();
    let apiListings = [];
    let sort = 'recent';

    // THE single filters state object. Nothing else filters anything.
    const filters = {};
    (function initFilters() {
      const fromUrl = readFiltersFromURL();
      Object.keys(URL_KEYS).forEach(function (k) {
        if (fromUrl[k]) filters[k] = fromUrl[k];
      });
      // Single-city pages are already scoped by URL: the Ville field is
      // informational, never a real multi-city switcher.
      filters.city = city;
    })();

    function allListings() { return apiListings.concat(baseListings); }

    function activeFilterCount() {
      return Object.keys(FILTER_CHIP_LABELS).filter(function (k) {
        return filters[k] !== undefined && filters[k] !== null && String(filters[k]) !== '';
      }).length;
    }

    function isSaved(id) {
      return typeof opts.isSaved === 'function' ? !!opts.isSaved(String(id)) : false;
    }

    function populateNeighborhoods() {
      const sels = $$('data-rmd-filter', 'neighborhood');
      if (!sels.length) return;
      const current = filters.neighborhood || '';
      const list = getNeighborhoodsForCity(allListings(), city);
      let optionsHtml = '<option value="">Tous les quartiers</option>' + list.map(function (n) {
        return '<option value="' + escapeHtml(n) + '"' +
          (normalizeText(n) === normalizeText(current) ? ' selected' : '') + '>' + escapeHtml(n) + '</option>';
      }).join('');
      // A neighborhood from the URL that no longer exists in the data would
      // otherwise silently filter everything out with no visible control.
      if (current && !list.some(function (n) { return normalizeText(n) === normalizeText(current); })) {
        optionsHtml += '<option value="' + escapeHtml(current) + '" selected>' + escapeHtml(current) + '</option>';
      }
      sels.forEach(function (sel) { sel.innerHTML = optionsHtml; });
    }

    function syncControlsFromFilters() {
      $$('data-rmd-filter', 'city').forEach(function (el) {
        if ('value' in el) el.value = city; else el.textContent = city;
      });
      $$('data-rmd-filter', 'neighborhood').forEach(function (el) { el.value = filters.neighborhood || ''; });
      $$('data-rmd-filter', 'minPrice').forEach(function (el) { el.value = filters.minPrice || ''; });
      $$('data-rmd-filter', 'maxPrice').forEach(function (el) { el.value = filters.maxPrice || ''; });
      $$('data-rmd-filter', 'type').forEach(function (el) { el.value = filters.type || ''; });
      $$('data-rmd-filter', 'keyword').forEach(function (el) { el.value = filters.keyword || ''; });
      $$('data-rmd-filter', 'furnished').forEach(function (el) { el.value = filters.furnished || ''; });
      $$('data-rmd-filter', 'availability').forEach(function (el) { el.value = filters.availability || ''; });
      $$('data-rmd-filter', 'verified').forEach(function (el) { el.value = filters.verified || ''; });

      $$('data-rmd-toggle', 'furnished').forEach(function (el) { el.setAttribute('aria-pressed', filters.furnished === 'yes' ? 'true' : 'false'); });
      $$('data-rmd-toggle', 'availability').forEach(function (el) { el.setAttribute('aria-pressed', filters.availability === 'available' ? 'true' : 'false'); });
      $$('data-rmd-toggle', 'verified').forEach(function (el) { el.setAttribute('aria-pressed', filters.verified === 'yes' ? 'true' : 'false'); });

      document.querySelectorAll('[data-rmd-filter-group="type"]').forEach(function (group) {
        group.querySelectorAll('[data-type]').forEach(function (btn) {
          btn.setAttribute('aria-pressed', (btn.dataset.type || '') === (filters.type || '') ? 'true' : 'false');
        });
      });

      const budgetBtn = document.getElementById('filterBudgetBtn');
      if (budgetBtn) {
        const min = filters.minPrice, max = filters.maxPrice;
        budgetBtn.textContent = (min || max)
          ? (min ? Number(min).toLocaleString('fr-FR') : '0') + '–' + (max ? Number(max).toLocaleString('fr-FR') : '∞') + ' MAD'
          : 'Tous les budgets';
      }

      const count = activeFilterCount();
      document.querySelectorAll('[data-rmd-filter-count]').forEach(function (badge) {
        badge.textContent = String(count);
        badge.hidden = count === 0;
      });
    }

    function render() {
      const grid = $('grid');
      const header = $('results');
      if (!grid) return;
      const all = allListings();
      const filtered = sortListings(applyFilters(all, filters), sort);

      const countEl = $('count');
      if (countEl) countEl.textContent = String(filtered.length);

      if (all.length === 0) {
        if (header) header.innerHTML = '';
        renderNoInventory(grid, {
          city: city,
          onExploreOther: function () { window.location.href = 'index.html'; },
          onContact: function () { window.location.href = 'contact.html'; },
        });
        return;
      }

      if (header) {
        renderResultsHeader(header, {
          count: filtered.length,
          filters: filters,
          sort: sort,
          cityLabel: city,
          onRemoveFilter: function (key) { setFilter(key, ''); },
          onSortChange: function (v) { sort = v; render(); },
          onViewAllCities: function () { window.location.href = 'index.html'; },
        });
      }

      if (filtered.length === 0) {
        renderNoResults(grid, { onReset: resetFilters, onViewAll: resetFilters });
        return;
      }

      grid.innerHTML = filtered.map(function (l) {
        return renderListingCard(l, { isSaved: isSaved(l.id) });
      }).join('');
      wireImageFallbacks(grid);
    }

    function commit() {
      writeFiltersToURL(filters);
      syncControlsFromFilters();
      render();
    }

    function setFilter(key, value) {
      if (key === 'city') return; // locked to the page's city
      if (value === undefined || value === null || String(value) === '') delete filters[key];
      else filters[key] = String(value);
      // Tracked at the moment a real free-text search executes - not on
      // every filter chip click (city/type/price/neighborhood aren't a
      // "search"), not on an empty/cleared value, and never with the
      // actual search term (see js/analytics.js's whitelist - 'search'
      // carries no query text).
      if (key === 'keyword' && String(value || '').trim() && window.RMD && window.RMD.trackFirstParty) {
        window.RMD.trackFirstParty('search');
      }
      commit();
    }

    function resetFilters() {
      Object.keys(URL_KEYS).forEach(function (k) { delete filters[k]; });
      filters.city = city;
      sort = 'recent';
      commit();
      closeSheet();
    }

    /* --- advanced-filters sheet (opened from any number of triggers) --- */
    let sheetOpenerEl = null;
    function openSheet(e) {
      const sheet = $('sheet'), backdrop = $('backdrop');
      if (!sheet) return;
      sheetOpenerEl = (e && e.currentTarget) || null;
      sheet.hidden = false;
      if (backdrop) { backdrop.hidden = false; backdrop.classList.add('show'); }
      document.querySelectorAll('[data-open-filter-sheet]').forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
      document.body.style.overflow = 'hidden';
      const first = sheet.querySelector('input, select, button');
      if (first) first.focus();
    }
    function closeSheet() {
      const sheet = $('sheet'), backdrop = $('backdrop');
      if (!sheet || sheet.hidden) return;
      sheet.hidden = true;
      if (backdrop) { backdrop.hidden = true; backdrop.classList.remove('show'); }
      document.querySelectorAll('[data-open-filter-sheet]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      document.body.style.overflow = '';
      if (sheetOpenerEl) { sheetOpenerEl.focus(); sheetOpenerEl = null; }
    }

    function wire() {
      const form = $('form');
      if (form) {
        form.addEventListener('submit', function (e) { e.preventDefault(); commit(); });
      }

      $$('data-rmd-filter', 'neighborhood').forEach(function (el) {
        el.addEventListener('change', function () { setFilter('neighborhood', el.value); });
      });

      const debouncedPrice = debounce(function (key, el) { setFilter(key, el.value); }, 300);
      ['minPrice', 'maxPrice'].forEach(function (key) {
        $$('data-rmd-filter', key).forEach(function (el) {
          el.addEventListener('input', function () { debouncedPrice(key, el); });
          el.addEventListener('change', function () { setFilter(key, el.value); });
        });
      });

      $$('data-rmd-filter', 'type').forEach(function (el) {
        el.addEventListener('change', function () { setFilter('type', el.value); });
      });
      document.querySelectorAll('[data-rmd-filter-group="type"]').forEach(function (group) {
        group.addEventListener('click', function (e) {
          const btn = e.target.closest('[data-type]');
          if (!btn) return;
          setFilter('type', btn.dataset.type || '');
        });
      });

      $$('data-rmd-filter', 'keyword').forEach(function (el) {
        const debouncedKeyword = debounce(function () { setFilter('keyword', el.value); }, 300);
        el.addEventListener('input', debouncedKeyword);
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); setFilter('keyword', el.value); closeSheet(); }
        });
      });
      ['furnished', 'availability', 'verified'].forEach(function (key) {
        $$('data-rmd-filter', key).forEach(function (el) {
          el.addEventListener('change', function () { setFilter(key, el.value); });
        });
      });

      $$('data-rmd-toggle', 'furnished').forEach(function (el) {
        el.addEventListener('click', function () { setFilter('furnished', filters.furnished === 'yes' ? '' : 'yes'); });
      });
      $$('data-rmd-toggle', 'availability').forEach(function (el) {
        el.addEventListener('click', function () { setFilter('availability', filters.availability === 'available' ? '' : 'available'); });
      });
      $$('data-rmd-toggle', 'verified').forEach(function (el) {
        el.addEventListener('click', function () { setFilter('verified', filters.verified === 'yes' ? '' : 'yes'); });
      });

      // Budget popover (desktop row1) — independent open/close, not the sheet.
      const budgetBtn = document.getElementById('filterBudgetBtn');
      const budgetPop = document.getElementById('budgetPop');
      if (budgetBtn && budgetPop) {
        budgetBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          const willOpen = budgetPop.hidden;
          budgetPop.hidden = !willOpen;
          budgetBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
          if (willOpen) { const f = budgetPop.querySelector('input'); if (f) f.focus(); }
        });
        document.addEventListener('click', function (e) {
          if (!budgetPop.hidden && !budgetPop.contains(e.target) && e.target !== budgetBtn) {
            budgetPop.hidden = true;
            budgetBtn.setAttribute('aria-expanded', 'false');
          }
        });
        const applyBtn = document.getElementById('budgetApplyBtn');
        if (applyBtn) applyBtn.addEventListener('click', function () {
          budgetPop.hidden = true;
          budgetBtn.setAttribute('aria-expanded', 'false');
          budgetBtn.focus();
        });
      }

      // Any number of "open the filters sheet" triggers (desktop "Plus de
      // filtres", mobile "Filtres (n)") — all wired the same way.
      document.querySelectorAll('[data-open-filter-sheet]').forEach(function (btn) {
        btn.addEventListener('click', openSheet);
      });
      const backdrop = $('backdrop');
      if (backdrop) backdrop.addEventListener('click', closeSheet);
      const sheetClose = $('sheetClose');
      if (sheetClose) sheetClose.addEventListener('click', closeSheet);
      const sheetApply = $('sheetApply');
      if (sheetApply) sheetApply.addEventListener('click', function () { commit(); closeSheet(); });
      const sheetReset = $('sheetReset');
      if (sheetReset) sheetReset.addEventListener('click', resetFilters);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
      // Swipe-down-to-dismiss on the sheet handle/panel (touch only).
      const sheetEl = $('sheet');
      if (sheetEl) {
        let touchStartY = null;
        sheetEl.addEventListener('touchstart', function (e) { touchStartY = e.touches[0].clientY; }, { passive: true });
        sheetEl.addEventListener('touchend', function (e) {
          if (touchStartY === null) return;
          const dy = e.changedTouches[0].clientY - touchStartY;
          touchStartY = null;
          if (dy > 80) closeSheet();
        }, { passive: true });
      }

      const resetBtn = $('reset');
      if (resetBtn) resetBtn.addEventListener('click', resetFilters);

      // Card interactions (delegated — no inline handlers, CSP-safe).
      const grid = $('grid');
      if (grid) {
        grid.addEventListener('click', function (e) {
          const fav = e.target.closest('[data-fav-id]');
          if (fav) {
            e.preventDefault();
            e.stopPropagation();
            const id = String(fav.dataset.favId);
            if (typeof opts.onToggleFavorite === 'function') opts.onToggleFavorite(id);
            const nowSaved = isSaved(id);
            fav.setAttribute('aria-pressed', nowSaved ? 'true' : 'false');
            fav.setAttribute('aria-label', nowSaved ? 'Retirer des favoris' : 'Sauvegarder ce logement');
            return;
          }
          const open = e.target.closest('[data-open-id]');
          if (open && typeof opts.onOpenListing === 'function') {
            e.preventDefault();
            opts.onOpenListing(String(open.dataset.openId));
          }
        });
      }
    }

    /* --- optional API merge, isolated so a failure never blanks the page --- */
    async function loadApi() {
      if (typeof opts.loadApiListings !== 'function') return;
      const errBox = $('mergeError');
      if (errBox) errBox.innerHTML = '';
      try {
        const extra = await opts.loadApiListings();
        apiListings = Array.isArray(extra) ? extra : [];
        populateNeighborhoods();
        syncControlsFromFilters();
        render();
      } catch (e) {
        apiListings = [];
        if (errBox) renderError(errBox, { onRetry: loadApi });
        render(); // static listings still render — graceful degradation
      }
    }

    function start() {
      wire();
      populateNeighborhoods();
      syncControlsFromFilters();
      render();
      loadApi();
    }

    return {
      start: start,
      render: render,
      resetFilters: resetFilters,
      setFilter: setFilter,
      getFilters: function () { return Object.assign({}, filters); },
      getListings: allListings,
      setBaseListings: function (l) { baseListings = (l || []).slice(); populateNeighborhoods(); render(); },
    };
  }

  window.RMD_LISTINGS = {
    normalizeText: normalizeText,
    PROPERTY_TYPES: PROPERTY_TYPES,
    normalizePropertyType: normalizePropertyType,
    propertyTypeLabel: propertyTypeLabel,
    parsePrice: parsePrice,
    formatPriceMAD: formatPriceMAD,
    matchesFilters: matchesFilters,
    applyFilters: applyFilters,
    getNeighborhoodsForCity: getNeighborhoodsForCity,
    readFiltersFromURL: readFiltersFromURL,
    writeFiltersToURL: writeFiltersToURL,
    debounce: debounce,
    escapeHtml: escapeHtml,
    inferFurnished: inferFurnished,
    wireImageFallback: wireImageFallback,
    wireImageFallbacks: wireImageFallbacks,
    showComingSoonToast: showComingSoonToast,
    renderSkeletons: renderSkeletons,
    renderListingCard: renderListingCard,
    renderResultsHeader: renderResultsHeader,
    renderNoResults: renderNoResults,
    renderNoInventory: renderNoInventory,
    renderError: renderError,
    sortListings: sortListings,
    createController: createController,
    FALLBACK_IMAGE: FALLBACK_IMAGE,
  };
})();
