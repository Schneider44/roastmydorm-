/**
 * RoastMyDorm — shared mobile-first property-detail page.
 *
 * Two data sources, one renderer:
 *  1. /logement/:slug          -> the live DB-backed Dorm record
 *                                 (GET /api/dorms/slug/:slug, admin preview
 *                                 tokens and old-slug redirects supported).
 *  2. property-detail.html?id= -> the legacy static properties.js dataset.
 *     property-detail.html?slug=   (preserved as-is; a separate feature.)
 *
 * Both are adapted into one neutral view-model and rendered by the same
 * section renderers. Every visible value comes from the record: a missing
 * value hides its row, a section with nothing useful hides entirely, and
 * nothing is ever invented. No `undefined`/`NaN`/`—` ever reaches the DOM.
 *
 * All admin-entered free text is written with textContent / setAttribute —
 * this file deliberately builds no HTML by string concatenation.
 */
(function () {
    'use strict';

    // RoastMyDorm's own published site-wide contact number, used only by the
    // legacy static dataset (whose listings have no per-listing advertiser).
    var WHATSAPP_NUMBER = '2126657134774';

    var API = (function () {
        var h = window.location.hostname;
        if (h && h !== 'localhost' && h !== '127.0.0.1') return 'https://www.roastmydorm.com/api';
        // Local dev: /logement/:slug is only ever served by the backend
        // process itself, so the API is on this exact origin (and port) -
        // don't assume the conventional 5000. Anything else locally (the
        // ?id= static path opened from a separate static server or file://)
        // keeps the conventional local backend port.
        if (/^\/logement\//.test(window.location.pathname)) return window.location.origin + '/api';
        return 'http://localhost:5000/api';
    })();

    var SITE_ORIGIN = 'https://www.roastmydorm.com';

    // =====================================================================
    // Formatting layer — pure functions, one dictionary each. Swapping in an
    // EN/AR dictionary later means touching only this block, never a call site.
    // =====================================================================

    var PROPERTY_TYPE_LABELS = {
        // Dorm.propertyType enum
        dormitory: 'Résidence étudiante',
        apartment: 'Appartement',
        studio: 'Studio',
        shared_room: 'Chambre partagée',
        private_room: 'Chambre privée',
        // legacy static dataset vocabulary
        chambre: 'Chambre privée',
        colocation: 'Colocation',
        appartement: 'Appartement',
        villa: 'Villa',
    };

    var PROPERTY_TYPE_ICONS = {
        dormitory: 'fa-building-columns',
        apartment: 'fa-building',
        studio: 'fa-door-closed',
        shared_room: 'fa-people-roof',
        private_room: 'fa-bed',
        chambre: 'fa-bed',
        colocation: 'fa-people-roof',
        appartement: 'fa-building',
        villa: 'fa-house',
    };

    var ADVERTISER_TYPE_LABELS = {
        owner: 'Propriétaire',
        agency: 'Agence',
        residence: 'Résidence',
        tenant: 'Locataire',
    };

    var BEDROOM_TYPE_LABELS = {
        private: 'Chambre privée',
        shared: 'Chambre partagée',
    };

    // Every value of the four Dorm.amenities sub-array enums has both a label
    // and an icon here (basic 7 + security 5 + common 8 + services 5 = 25).
    var AMENITY_LABELS = {
        // basic
        wifi: 'Wi-Fi',
        heating: 'Chauffage',
        air_conditioning: 'Climatisation',
        furnished: 'Meublé',
        kitchen: 'Cuisine équipée',
        bathroom: 'Salle de bain privée',
        laundry: 'Machine à laver',
        // security
        security_guard: 'Gardien',
        cctv: 'Vidéosurveillance',
        keycard_access: 'Accès par badge',
        gated_community: 'Résidence fermée',
        safe: 'Coffre-fort',
        // common
        study_room: 'Salle d’étude',
        common_room: 'Salle commune',
        gym: 'Salle de sport',
        pool: 'Piscine',
        garden: 'Jardin',
        rooftop: 'Terrasse',
        parking: 'Parking',
        elevator: 'Ascenseur',
        // services
        cleaning_service: 'Service de ménage',
        maintenance: 'Maintenance',
        '24_7_support': 'Assistance 24/7',
        meal_plan: 'Repas inclus',
        laundry_service: 'Service de blanchisserie',
    };

    var AMENITY_ICONS = {
        wifi: 'fa-wifi',
        heating: 'fa-temperature-three-quarters',
        air_conditioning: 'fa-snowflake',
        furnished: 'fa-couch',
        kitchen: 'fa-kitchen-set',
        bathroom: 'fa-bath',
        laundry: 'fa-soap',
        security_guard: 'fa-shield-halved',
        cctv: 'fa-video',
        keycard_access: 'fa-id-card',
        gated_community: 'fa-lock',
        safe: 'fa-vault',
        study_room: 'fa-book-open',
        common_room: 'fa-couch',
        gym: 'fa-dumbbell',
        pool: 'fa-water-ladder',
        garden: 'fa-leaf',
        rooftop: 'fa-sun',
        parking: 'fa-square-parking',
        elevator: 'fa-elevator',
        cleaning_service: 'fa-broom',
        maintenance: 'fa-wrench',
        '24_7_support': 'fa-headset',
        meal_plan: 'fa-utensils',
        laundry_service: 'fa-shirt',
    };

    var REPORT_REASON_LABELS = {
        scam: 'Annonce frauduleuse',
        misinformation: 'Informations inexactes',
        inappropriate: 'Contenu inapproprié',
        other: 'Autre',
    };

    /** The city listing pages that actually exist on the site. */
    var CITY_PAGES = {
        casablanca: '/casablanca-dorms.html',
        rabat: '/rabat-dorms.html',
        marrakech: '/marrakech-dorms.html',
        settat: '/settat-logement.html',
    };

    function isNum(v) {
        return typeof v === 'number' && isFinite(v);
    }

    function isText(v) {
        return typeof v === 'string' && v.trim().length > 0;
    }

    function formatPropertyType(type) {
        return (type && PROPERTY_TYPE_LABELS[type]) || null;
    }

    function propertyTypeIcon(type) {
        return (type && PROPERTY_TYPE_ICONS[type]) || 'fa-house';
    }

    function formatMoney(amount, currency) {
        if (!isNum(amount)) return null;
        return amount.toLocaleString('fr-FR') + ' ' + (currency || 'MAD');
    }

    function formatDate(value) {
        if (!value) return null;
        var d = value instanceof Date ? value : new Date(value);
        if (isNaN(d.getTime())) return null;
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    function formatAmenity(key) {
        if (!isText(key)) return null;
        return {
            key: key,
            label: AMENITY_LABELS[key] || null,
            icon: AMENITY_ICONS[key] || 'fa-circle-check',
        };
    }

    function formatAdvertiserType(type) {
        return (type && ADVERTISER_TYPE_LABELS[type]) || null;
    }

    function formatBedroomType(type) {
        return (type && BEDROOM_TYPE_LABELS[type]) || null;
    }

    /**
     * One short human sentence for the availability state, or null when the
     * record says nothing useful about it.
     */
    function formatAvailability(availability) {
        if (!availability) return null;
        if (availability.isAvailable === false) return 'Indisponible';
        var from = formatDate(availability.availableFrom);
        if (from) {
            var fromDate = new Date(availability.availableFrom);
            if (fromDate.getTime() > Date.now()) return 'Disponible dès le ' + from;
        }
        if (availability.isAvailable === true) return 'Disponible maintenant';
        return null;
    }

    function formatMonths(n) {
        if (!isNum(n) || n <= 0) return null;
        return n + ' mois'; // 'mois' is invariable in French
    }

    function capitalize(s) {
        return isText(s) ? s.charAt(0).toUpperCase() + s.slice(1) : s;
    }

    function normalizeCity(city) {
        if (!isText(city)) return '';
        var lower = city.trim().toLowerCase();
        return lower.normalize
            ? lower.normalize('NFD').replace(/[̀-ͯ]/g, '')
            : lower;
    }

    /** The city listing page for a listing's city, or the homepage. */
    function cityPageFor(city) {
        var key = normalizeCity(city);
        return CITY_PAGES[key] || '/index.html';
    }

    function imageUrl(value) {
        if (!isText(value)) return null;
        if (/^(https?:)?\/\//i.test(value) || value.charAt(0) === '/') return value;
        return encodeURI(value);
    }

    function absoluteUrl(value) {
        var u = imageUrl(value);
        if (!u) return null;
        if (/^(https?:)?\/\//i.test(u)) return u;
        return SITE_ORIGIN + (u.charAt(0) === '/' ? '' : '/') + u;
    }

    // =====================================================================
    // Small DOM helpers — no innerHTML anywhere in this file.
    // =====================================================================

    var $ = function (id) { return document.getElementById(id); };

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function icon(name) {
        var i = document.createElement('i');
        i.className = 'fa-solid ' + name;
        i.setAttribute('aria-hidden', 'true');
        return i;
    }

    function brandIcon(name) {
        var i = document.createElement('i');
        i.className = 'fa-brands ' + name;
        i.setAttribute('aria-hidden', 'true');
        return i;
    }

    function clear(node) {
        while (node.firstChild) node.removeChild(node.firstChild);
    }

    function prefersReducedMotion() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    var liveRegion;
    function announce(msg) {
        if (!liveRegion) {
            liveRegion = el('div', 'rmd-sr-only');
            liveRegion.setAttribute('role', 'status');
            document.body.appendChild(liveRegion);
        }
        liveRegion.textContent = msg;
    }

    function getToken() {
        try {
            return localStorage.getItem('rmd_token') ||
                (JSON.parse(localStorage.getItem('rmd_session') || '{}').accessToken) || null;
        } catch (e) {
            return null;
        }
    }

    // =====================================================================
    // Dialog plumbing: focus trap + Escape + focus restore, shared by the
    // lightbox and both bottom sheets.
    // =====================================================================

    var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function focusableIn(container) {
        return Array.prototype.filter.call(container.querySelectorAll(FOCUSABLE), function (node) {
            return !node.hasAttribute('hidden') && node.offsetParent !== null;
        });
    }

    function openDialog(panel, backdrop, trigger, onClose) {
        var previouslyFocused = trigger || document.activeElement;
        panel.hidden = false;
        if (backdrop) backdrop.hidden = false;
        document.body.style.overflow = 'hidden';

        function onKeydown(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                close();
                return;
            }
            if (e.key !== 'Tab') return;
            var items = focusableIn(panel);
            if (!items.length) { e.preventDefault(); return; }
            var first = items[0];
            var last = items[items.length - 1];
            if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
                e.preventDefault(); last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault(); first.focus();
            }
        }

        function close() {
            document.removeEventListener('keydown', onKeydown, true);
            if (backdrop) {
                backdrop.hidden = true;
                backdrop.removeEventListener('click', close);
            }
            panel.hidden = true;
            document.body.style.overflow = '';
            if (previouslyFocused && typeof previouslyFocused.focus === 'function') previouslyFocused.focus();
            if (onClose) onClose();
        }

        document.addEventListener('keydown', onKeydown, true);
        if (backdrop) backdrop.addEventListener('click', close);

        var items = focusableIn(panel);
        if (items.length) items[0].focus();
        else panel.focus();

        return close;
    }

    // =====================================================================
    // Data loading + view-model adaptation
    // =====================================================================

    var LOGEMENT_PATH_RE = /^\/logement\/([^/?#]+)/;

    /** Stable sort putting the isPrimary image first, otherwise array order. */
    function orderImages(images) {
        var list = (images || []).filter(function (img) { return img && isText(img.url); });
        var primaryIndex = -1;
        for (var i = 0; i < list.length; i++) {
            if (list[i].isPrimary) { primaryIndex = i; break; }
        }
        if (primaryIndex > 0) {
            var primary = list[primaryIndex];
            list = [primary].concat(list.slice(0, primaryIndex), list.slice(primaryIndex + 1));
        }
        return list;
    }

    function adaptDorm(dorm, similar, isDraft) {
        var amenityKeys = []
            .concat(dorm.amenities && dorm.amenities.basic || [])
            .concat(dorm.amenities && dorm.amenities.security || [])
            .concat(dorm.amenities && dorm.amenities.common || [])
            .concat(dorm.amenities && dorm.amenities.services || []);
        var amenities = amenityKeys.map(formatAmenity).filter(function (a) { return a && a.label; });
        var address = (dorm.location && dorm.location.address) || {};
        var coords = (dorm.location && dorm.location.coordinates) || {};
        var pricing = dorm.pricing || {};
        var contact = dorm.contactInfo || {};

        return {
            source: 'db',
            id: dorm._id,
            dormId: dorm._id,
            slug: dorm.slug || null,
            url: SITE_ORIGIN + '/logement/' + encodeURIComponent(dorm.slug || dorm._id),
            isDraft: !!isDraft,

            title: isText(dorm.name) ? dorm.name : null,
            description: isText(dorm.description) ? dorm.description : null,
            propertyType: dorm.propertyType || null,
            city: isText(address.city) ? address.city : null,
            neighborhood: isText(address.neighborhood) ? address.neighborhood : null,

            currency: pricing.currency || 'MAD',
            price: isNum(pricing.baseRent) ? pricing.baseRent : null,
            costs: {
                deposit: isNum(pricing.deposit) ? pricing.deposit : null,
                utilities: isNum(pricing.utilities) ? pricing.utilities : null,
                internet: isNum(pricing.internet) ? pricing.internet : null,
                cleaning: isNum(pricing.cleaning) ? pricing.cleaning : null,
            },

            availability: dorm.availability || null,
            bedrooms: isNum(dorm.bedrooms) ? dorm.bedrooms : null,
            bathrooms: isNum(dorm.bathrooms) ? dorm.bathrooms : null,
            squareFootage: isNum(dorm.squareFootage) ? dorm.squareFootage : null,

            amenities: amenities,
            amenityKeys: amenityKeys,
            images: orderImages(dorm.images),
            videos: Array.isArray(dorm.videos) ? dorm.videos : [],

            colocation: (dorm.colocation && dorm.colocation.available === true) ? dorm.colocation : null,
            coordinates: (isNum(coords.latitude) && isNum(coords.longitude))
                ? { lat: coords.latitude, lng: coords.longitude } : null,
            nearbyCampus: (dorm.nearbyCampus && isText(dorm.nearbyCampus.name)) ? dorm.nearbyCampus : null,
            nearbyUniversities: ((dorm.location && dorm.location.nearbyUniversities) || [])
                .filter(function (u) { return u && isText(u.name); }),

            verified: !!(dorm.verification && dorm.verification.isVerified),
            advertiser: {
                firstName: isText(contact.firstName) ? contact.firstName : null,
                type: contact.advertiserType || null,
                responseTime: isText(contact.responseTime) ? contact.responseTime : null,
                hasPhone: contact.hasPhone === true,
                hasWhatsapp: contact.hasWhatsapp === true,
                hasEmail: contact.hasEmail === true,
            },
            similar: (similar || []).filter(function (s) { return s && isText(s.slug); }),
        };
    }

    function adaptStaticProperty(p) {
        var amenities = (p.amenities || [])
            .filter(function (a) { return a && isText(a.label); })
            .map(function (a) {
                return { key: a.key || a.label, label: a.label, icon: a.icon || 'fa-circle-check' };
            });
        return {
            source: 'static',
            id: p.id,
            dormId: null,
            slug: p.slug || null,
            url: SITE_ORIGIN + '/property-detail.html?id=' + encodeURIComponent(p.id),
            isDraft: false,

            title: isText(p.title) ? p.title : null,
            description: isText(p.description) ? p.description : null,
            propertyType: p.propertyType || null,
            city: isText(p.city) ? capitalize(p.city) : null,
            neighborhood: isText(p.neighbourhood) ? p.neighbourhood : null,

            currency: p.currency || 'MAD',
            price: isNum(p.price) ? p.price : null,
            costs: {
                deposit: isNum(p.deposit) ? p.deposit : null,
                utilities: null, internet: null, cleaning: null,
            },

            availability: {
                isAvailable: p.available !== false,
                availableFrom: p.moveInDate || null,
                minimumStay: null,
            },
            bedrooms: isNum(p.bedrooms) ? p.bedrooms : null,
            bathrooms: isNum(p.bathrooms) ? p.bathrooms : null,
            squareFootage: isNum(p.surface) ? p.surface : null,

            amenities: amenities,
            amenityKeys: amenities.map(function (a) { return a.key; }),
            images: (p.images || []).filter(isText).map(function (url) { return { url: url }; }),

            colocation: null,
            coordinates: (isNum(p.lat) && isNum(p.lng)) ? { lat: p.lat, lng: p.lng } : null,
            nearbyCampus: null,
            nearbyUniversities: [],

            verified: !!(p.verification && p.verification.status),
            advertiser: { firstName: null, type: null, responseTime: null, hasPhone: false, hasWhatsapp: false, hasEmail: false },
            similar: [],
            furnished: p.furnished === true,
        };
    }

    async function loadProperty() {
        var pathMatch = window.location.pathname.match(LOGEMENT_PATH_RE);
        if (pathMatch) {
            var slug = decodeURIComponent(pathMatch[1]);
            var preview = new URLSearchParams(window.location.search).get('preview');
            var url = API + '/dorms/slug/' + encodeURIComponent(slug) +
                (preview ? '?preview=' + encodeURIComponent(preview) : '');
            try {
                var res = await fetch(url);
                if (!res.ok) return { vm: null };
                var json = await res.json();
                if (!json || !json.success || !json.data) return { vm: null };
                return {
                    vm: adaptDorm(json.data, json.similar, json.isDraft),
                    redirectTo: json.redirectTo ? '/logement/' + json.redirectTo : null,
                    previewToken: preview || null,
                };
            } catch (e) {
                return { vm: null };
            }
        }

        var params = new URLSearchParams(window.location.search);
        var id = params.get('id');
        var qSlug = params.get('slug');
        var list = window.RMD_PROPERTIES || [];
        var found = null;
        if (id) found = list.filter(function (p) { return p.id === id; })[0] || null;
        else if (qSlug) found = list.filter(function (p) { return p.slug === qSlug; })[0] || null;
        return { vm: found ? adaptStaticProperty(found) : null };
    }

    // =====================================================================
    // Section renderers
    // =====================================================================

    function renderBadges(vm) {
        var wrap = $('statusBadges');
        clear(wrap);

        function badge(text, iconName, variant) {
            var span = el('span', 'pd-badge' + (variant ? ' ' + variant : ''));
            span.appendChild(icon(iconName));
            span.appendChild(document.createTextNode(text));
            wrap.appendChild(span);
        }

        if (vm.verified) badge('Annonce vérifiée', 'fa-circle-check');
        var available = vm.availability ? vm.availability.isAvailable !== false : null;
        if (available === true) badge('Disponible', 'fa-calendar-check');
        else if (available === false) badge('Indisponible', 'fa-calendar-xmark', 'is-warn');
        if (isFurnished(vm)) badge('Meublé', 'fa-couch', 'is-neutral');
        if (vm.colocation) badge('Colocation', 'fa-people-roof', 'is-neutral');
    }

    function isFurnished(vm) {
        if (vm.furnished === true) return true;
        return (vm.amenityKeys || []).indexOf('furnished') !== -1;
    }

    function renderHeadline(vm) {
        $('propTitle').textContent = vm.title || 'Logement étudiant';

        var placeParts = [];
        if (vm.neighborhood) placeParts.push(vm.neighborhood);
        if (vm.city) placeParts.push(capitalize(vm.city));
        var place = $('propPlace');
        if (placeParts.length) {
            $('propPlaceText').textContent = placeParts.join(', ');
            place.hidden = false;
        } else {
            place.hidden = true;
        }

        var priceEl = $('propPrice');
        clear(priceEl);
        if (isNum(vm.price)) {
            priceEl.appendChild(document.createTextNode(vm.price.toLocaleString('fr-FR') + ' ' + vm.currency));
            priceEl.appendChild(el('span', null, ' / mois'));
            priceEl.hidden = false;
        } else {
            priceEl.hidden = true;
        }
    }

    /**
     * ONE generic chip builder: every candidate chip declares the value it
     * depends on, and any chip whose value is missing (or irrelevant for this
     * listing) simply never enters the list. Nothing is per-type hardcoded.
     */
    function buildChips(vm) {
        var chips = [];
        var coloc = vm.colocation;
        var amen = vm.amenityKeys || [];

        var typeLabel = formatPropertyType(vm.propertyType);
        if (typeLabel) chips.push({ icon: propertyTypeIcon(vm.propertyType), label: typeLabel });

        if (isFurnished(vm)) chips.push({ icon: 'fa-couch', label: 'Meublé' });

        // Private/shared bedroom only means something on a shared listing.
        if (coloc) {
            var bedroomType = formatBedroomType(coloc.bedroomType);
            if (bedroomType && bedroomType !== typeLabel) chips.push({ icon: 'fa-bed', label: bedroomType });
        }

        // A "private bathroom" claim is meaningless on a shared room.
        if (amen.indexOf('bathroom') !== -1 && vm.propertyType !== 'shared_room') {
            chips.push({ icon: 'fa-bath', label: 'Salle de bain privée' });
        }

        if (isNum(vm.bedrooms) && vm.bedrooms > 0) {
            chips.push({ icon: 'fa-bed', label: vm.bedrooms + (vm.bedrooms > 1 ? ' chambres' : ' chambre') });
        }
        if (isNum(vm.bathrooms) && vm.bathrooms > 0) {
            chips.push({ icon: 'fa-bath', label: vm.bathrooms + (vm.bathrooms > 1 ? ' salles de bain' : ' salle de bain') });
        }
        if (isNum(vm.squareFootage) && vm.squareFootage > 0) {
            chips.push({ icon: 'fa-vector-square', label: vm.squareFootage + ' m²' });
        }

        if (coloc && isNum(coloc.currentRoommates) && coloc.currentRoommates > 0) {
            chips.push({
                icon: 'fa-users',
                label: coloc.currentRoommates + (coloc.currentRoommates > 1 ? ' colocataires' : ' colocataire'),
            });
        }
        if (coloc && isNum(coloc.maxOccupancy) && coloc.maxOccupancy > 0) {
            chips.push({ icon: 'fa-user-group', label: 'Occupation maximale : ' + coloc.maxOccupancy });
        }

        var availabilityText = formatAvailability(vm.availability);
        if (availabilityText) chips.push({ icon: 'fa-calendar-day', label: availabilityText });

        var minStay = vm.availability ? formatMonths(vm.availability.minimumStay) : null;
        if (minStay && vm.availability.minimumStay > 1) {
            chips.push({ icon: 'fa-file-signature', label: 'Bail minimum ' + minStay });
        }

        return chips;
    }

    function renderChips(vm) {
        var list = $('factChips');
        clear(list);
        buildChips(vm).forEach(function (chip) {
            var li = el('li', 'filter-chip');
            li.appendChild(icon(chip.icon));
            li.appendChild(document.createTextNode(chip.label));
            list.appendChild(li);
        });
    }

    function renderVideos(vm) {
        [['videosSection', 'propertyVideos'], ['dtVideosSection', 'dtVideos']].forEach(function (ids) {
            var section = $(ids[0]);
            var list = $(ids[1]);
            if (!section || !list) return;
            clear(list);
            (vm.videos || []).forEach(function (record, index) {
                if (!/^\/uploads\/dorms\/[a-f0-9]{24}\/[a-f0-9]{32}\.(mp4|webm)$/.test(record.url || '')) return;
                var video = document.createElement('video');
                video.controls = true;
                video.playsInline = true;
                video.preload = 'none';
                video.setAttribute('aria-label', 'Visite en vidéo ' + (index + 1));
                video.style.cssText = 'display:block;width:100%;max-height:480px;background:#111;border-radius:12px;margin:12px 0';
                var source = document.createElement('source');
                source.src = imageUrl(record.url);
                source.type = record.mimeType;
                video.appendChild(source);
                list.appendChild(video);
                var fallback = el('a', null, 'Ouvrir la vidéo ' + (index + 1));
                fallback.href = imageUrl(record.url);
                list.appendChild(fallback);
            });
            section.hidden = !list.children.length;
        });
    }

    function renderDescription(vm) {
        var section = $('descriptionSection');
        if (!vm.description) { section.hidden = true; return; }
        section.hidden = false;

        var textEl = $('descriptionText');
        var toggle = $('descriptionToggle');
        textEl.textContent = vm.description; // textContent + white-space:pre-line

        // Only offer the toggle when the 4-line clamp actually truncates.
        requestAnimationFrame(function () {
            toggle.hidden = !(textEl.scrollHeight > textEl.clientHeight + 2);
        });

        toggle.addEventListener('click', function () {
            var expanded = textEl.classList.toggle('is-expanded');
            toggle.textContent = expanded ? 'Réduire la description' : 'Afficher toute la description';
            toggle.setAttribute('aria-expanded', String(expanded));
        });
    }

    function addRow(list, label, value, opts) {
        if (value == null || value === '') return false;
        var li = el('li', 'pd-row' + (opts && opts.stacked ? ' is-stacked' : '') + (opts && opts.highlight ? ' is-highlight' : ''));
        li.appendChild(el('span', 'pd-row-label', label));
        li.appendChild(el('span', 'pd-row-value', value));
        list.appendChild(li);
        return true;
    }

    /**
     * A stored 0 on a charge line means "included in the rent"; a stored
     * positive number is the real amount; a field that isn't stored at all is
     * omitted entirely rather than surfaced as "Non renseigné" — knowing a
     * routine line item wasn't filled in isn't information a renter needs.
     */
    function chargeValue(amount, currency, zeroLabel) {
        if (!isNum(amount)) return null;
        if (amount === 0) return zeroLabel || 'Inclus';
        return formatMoney(amount, currency);
    }

    function renderCosts(vm) {
        var section = $('costsSection');
        var list = $('costRows');
        clear(list);
        var any = false;

        any = addRow(list, 'Loyer mensuel', formatMoney(vm.price, vm.currency), { highlight: true }) || any;
        any = addRow(list, 'Caution', chargeValue(vm.costs.deposit, vm.currency, 'Aucune caution')) || any;
        any = addRow(list, 'Charges (eau, électricité)', chargeValue(vm.costs.utilities, vm.currency)) || any;
        any = addRow(list, 'Internet', chargeValue(vm.costs.internet, vm.currency)) || any;
        any = addRow(list, 'Ménage', chargeValue(vm.costs.cleaning, vm.currency)) || any;

        if (vm.availability) {
            var minStay = formatMonths(vm.availability.minimumStay);
            if (minStay && vm.availability.minimumStay > 1) {
                any = addRow(list, 'Durée minimale du bail', minStay) || any;
            }
            any = addRow(list, 'Disponible à partir du', formatDate(vm.availability.availableFrom)) || any;
        }

        section.hidden = !any;
    }

    function renderColocation(vm) {
        var section = $('colocationSection');
        var coloc = vm.colocation;
        if (!coloc) { section.hidden = true; return; }

        var list = $('colocationRows');
        clear(list);
        var any = false;

        any = addRow(list, 'Type de chambre', formatBedroomType(coloc.bedroomType)) || any;

        if (isNum(coloc.currentRoommates) || isNum(coloc.maxOccupancy)) {
            var parts = [];
            if (isNum(coloc.currentRoommates)) {
                parts.push(coloc.currentRoommates + (coloc.currentRoommates > 1 ? ' colocataires actuels' : ' colocataire actuel'));
            }
            if (isNum(coloc.maxOccupancy)) parts.push('maximum ' + coloc.maxOccupancy);
            any = addRow(list, 'Colocataires', parts.join(' · ')) || any;
        }

        [
            ['Profil recherché', coloc.preferredProfile],
            ['Tabac', coloc.smokingPolicy],
            ['Visites', coloc.visitorPolicy],
            ['Ménage', coloc.cleaningArrangement],
            ['Règles de la maison', coloc.houseRules],
        ].forEach(function (pair) {
            if (isText(pair[1])) {
                any = addRow(list, pair[0], pair[1].trim(), { stacked: true }) || any;
            }
        });

        section.hidden = !any;
    }

    function renderAmenities(vm) {
        var section = $('amenitiesSection');
        var grid = $('amenitiesGrid');
        clear(grid);
        var items = (vm.amenities || []).filter(function (a) { return a && isText(a.label); });
        if (!items.length) { section.hidden = true; return; }
        items.forEach(function (a) {
            var li = el('li', 'pd-amenity');
            li.appendChild(icon(a.icon));
            li.appendChild(el('span', null, a.label));
            grid.appendChild(li);
        });
        section.hidden = false;
    }

    function renderLocation(vm) {
        var section = $('locationSection');
        var list = $('locationRows');
        clear(list);
        var any = false;

        if (vm.neighborhood) any = addRow(list, 'Quartier', vm.neighborhood) || any;
        if (vm.city) any = addRow(list, 'Ville', capitalize(vm.city)) || any;

        if (vm.nearbyCampus) {
            var campusValue = isText(vm.nearbyCampus.travelTime)
                ? vm.nearbyCampus.name + ' · ' + vm.nearbyCampus.travelTime
                : vm.nearbyCampus.name;
            any = addRow(list, 'Campus le plus proche', campusValue) || any;
        }

        (vm.nearbyUniversities || []).forEach(function (u) {
            var bits = [];
            if (isNum(u.distance)) bits.push(u.distance + ' km');
            if (isNum(u.walkingTime)) bits.push(u.walkingTime + ' min à pied');
            any = addRow(list, u.name, bits.length ? bits.join(' · ') : ' ') || any;
        });

        // Real, keyless OpenStreetMap embed at a deliberately wide bbox: the
        // neighbourhood, not a precise pin on someone's front door.
        var mapWrap = $('mapWrap');
        if (vm.coordinates) {
            var lat = vm.coordinates.lat;
            var lng = vm.coordinates.lng;
            var dLat = 0.014;
            var dLng = 0.020;
            var bbox = [lng - dLng, lat - dLat, lng + dLng, lat + dLat].map(function (n) { return n.toFixed(5); }).join(',');
            $('mapFrame').setAttribute('src',
                'https://www.openstreetmap.org/export/embed.html?bbox=' + encodeURIComponent(bbox) + '&layer=mapnik');
            mapWrap.hidden = false;
            any = true;
        } else {
            mapWrap.hidden = true;
        }

        section.hidden = !any;
    }

    function renderAdvertiser(vm, ctx) {
        var section = $('advertiserSection');
        var adv = vm.advertiser || {};
        var typeLabel = formatAdvertiserType(adv.type);

        if (!adv.firstName && !typeLabel && !vm.verified && !adv.responseTime && vm.source !== 'db') {
            section.hidden = true;
            return;
        }

        var nameEl = $('advertiserName');
        clear(nameEl);
        var displayName = adv.firstName || 'Annonceur';
        nameEl.appendChild(document.createTextNode(displayName));
        if (vm.verified) {
            var badge = el('span', 'verified-badge');
            badge.appendChild(icon('fa-circle-check'));
            badge.appendChild(document.createTextNode('Vérifié'));
            nameEl.appendChild(badge);
        }
        $('advertiserInitial').textContent = displayName.charAt(0).toUpperCase();

        var metaParts = [];
        if (typeLabel) metaParts.push(typeLabel);
        if (adv.responseTime) metaParts.push('Répond : ' + adv.responseTime);
        var metaEl = $('advertiserMeta');
        if (metaParts.length) {
            metaEl.textContent = metaParts.join(' · ');
            metaEl.hidden = false;
        } else {
            metaEl.hidden = true;
        }

        // Reporting targets a real Dorm record, so it only exists for DB listings.
        var reportBtn = $('reportBtn');
        if (vm.source === 'db' && vm.dormId) {
            reportBtn.hidden = false;
            reportBtn.addEventListener('click', function () { openReportSheet(vm, ctx, reportBtn); });
        } else {
            reportBtn.hidden = true;
        }

        section.hidden = false;
    }

    function renderSimilar(vm) {
        var section = $('similarSection');
        var list = $('similarList');
        var fallback = $('similarFallbackBtn');
        clear(list);

        var items = vm.similar || [];
        if (items.length) {
            items.forEach(function (item) {
                var li = document.createElement('li');
                var a = el('a', 'pd-similar-card');
                a.setAttribute('href', '/logement/' + encodeURIComponent(item.slug));

                var media = el('div', 'pd-similar-media');
                var firstImage = orderImages(item.images)[0];
                var src = firstImage ? imageUrl(firstImage.url) : null;
                if (src) {
                    var img = document.createElement('img');
                    img.setAttribute('src', src);
                    img.setAttribute('alt', '');
                    img.setAttribute('loading', 'lazy');
                    media.appendChild(img);
                } else {
                    media.appendChild(icon('fa-image'));
                }
                a.appendChild(media);

                var body = el('div', 'pd-similar-body');
                body.appendChild(el('h3', 'pd-similar-title', isText(item.name) ? item.name : 'Logement'));
                var addr = (item.location && item.location.address) || {};
                var placeBits = [];
                if (isText(addr.neighborhood)) placeBits.push(addr.neighborhood);
                if (isText(addr.city)) placeBits.push(capitalize(addr.city));
                if (placeBits.length) body.appendChild(el('p', 'pd-similar-place', placeBits.join(', ')));
                var rent = item.pricing && item.pricing.baseRent;
                if (isNum(rent)) body.appendChild(el('p', 'pd-similar-price', rent.toLocaleString('fr-FR') + ' MAD / mois'));
                a.appendChild(body);

                li.appendChild(a);
                list.appendChild(li);
            });
            fallback.hidden = true;
            section.hidden = false;
            return;
        }

        // No similar listings: offer the listing page for THIS listing's own
        // city — never a hardcoded city.
        if (vm.city) {
            fallback.setAttribute('href', cityPageFor(vm.city));
            fallback.textContent = 'Voir les logements à ' + capitalize(vm.city);
            fallback.hidden = false;
            section.hidden = false;
        } else {
            section.hidden = true;
        }
    }

    // =====================================================================
    // Gallery + lightbox
    // =====================================================================

    var gallery = { images: [], index: 0 };

    function altFor(vm, i, total) {
        var base = vm.title || 'Logement étudiant';
        var place = vm.neighborhood || vm.city;
        var where = place ? (base + ' à ' + capitalize(place)) : base;
        return total > 1 ? (where + ' — photo ' + (i + 1) + ' sur ' + total) : where;
    }

    function renderGallery(vm) {
        var track = $('galleryTrack');
        var counter = $('galleryCounter');
        var dots = $('galleryDots');
        var viewBtn = $('viewPhotosBtn');
        var strip = $('galleryFilmstrip');
        clear(track); clear(dots); clear(strip);

        var images = vm.images || [];
        gallery.images = images;
        gallery.index = 0;

        if (!images.length) {
            var empty = el('div', 'pd-gallery-empty');
            empty.appendChild(icon('fa-camera'));
            empty.appendChild(el('span', null, 'Aucune photo pour le moment'));
            track.appendChild(empty);
            counter.hidden = true;
            dots.hidden = true;
            viewBtn.hidden = true;
            strip.hidden = true;
            return;
        }

        images.forEach(function (image, i) {
            var slide = el('div', 'pd-slide');
            slide.setAttribute('role', 'group');
            slide.setAttribute('aria-roledescription', 'diapositive');
            slide.setAttribute('aria-label', 'Photo ' + (i + 1) + ' sur ' + images.length);

            var btn = document.createElement('button');
            btn.type = 'button';
            btn.setAttribute('aria-label', 'Agrandir la photo ' + (i + 1));
            var img = document.createElement('img');
            img.setAttribute('src', imageUrl(image.url));
            img.setAttribute('alt', isText(image.caption) ? image.caption : altFor(vm, i, images.length));
            img.setAttribute('loading', i === 0 ? 'eager' : 'lazy');
            btn.appendChild(img);
            btn.addEventListener('click', function () { openLightbox(vm, i, btn); });
            slide.appendChild(btn);
            track.appendChild(slide);

            if (images.length > 1) {
                var dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'pd-dot';
                dot.setAttribute('aria-label', 'Aller à la photo ' + (i + 1));
                dot.addEventListener('click', function () { scrollToSlide(i); });
                dots.appendChild(dot);

                var thumb = document.createElement('button');
                thumb.type = 'button';
                thumb.className = 'pd-thumb';
                thumb.setAttribute('aria-label', 'Voir la photo ' + (i + 1));
                var timg = document.createElement('img');
                timg.setAttribute('src', imageUrl(image.url));
                timg.setAttribute('alt', '');
                timg.setAttribute('loading', 'lazy');
                thumb.appendChild(timg);
                thumb.addEventListener('click', function () { scrollToSlide(i); });
                strip.appendChild(thumb);
            }
        });

        var multiple = images.length > 1;
        counter.hidden = !multiple;
        dots.hidden = !multiple;
        strip.hidden = !multiple;

        viewBtn.hidden = false;
        clear(viewBtn);
        viewBtn.appendChild(icon('fa-images'));
        viewBtn.appendChild(document.createTextNode(
            multiple ? ('Voir les ' + images.length + ' photos') : 'Voir la photo'));
        viewBtn.addEventListener('click', function () { openLightbox(vm, gallery.index, viewBtn); });

        // Native scroll-snap + one scroll listener: works for EVERY slide
        // including the first one.
        var ticking = false;
        track.addEventListener('scroll', function () {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(function () {
                ticking = false;
                var width = track.clientWidth || 1;
                var next = Math.round(track.scrollLeft / width);
                if (next !== gallery.index && next >= 0 && next < images.length) {
                    gallery.index = next;
                    paintGalleryPosition();
                }
            });
        }, { passive: true });

        paintGalleryPosition();
    }

    function scrollToSlide(i) {
        var track = $('galleryTrack');
        var slide = track.children[i];
        if (!slide) return;
        track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        gallery.index = i;
        paintGalleryPosition();
    }

    function paintGalleryPosition() {
        var total = gallery.images.length;
        if (!total) return;
        $('galleryCounter').textContent = (gallery.index + 1) + ' / ' + total;
        Array.prototype.forEach.call($('galleryDots').children, function (dot, i) {
            if (i === gallery.index) dot.setAttribute('aria-current', 'true');
            else dot.removeAttribute('aria-current');
        });
        Array.prototype.forEach.call($('galleryFilmstrip').children, function (thumb, i) {
            if (i === gallery.index) thumb.setAttribute('aria-current', 'true');
            else thumb.removeAttribute('aria-current');
        });
    }

    var closeLightboxFn = null;

    function openLightbox(vm, startIndex, trigger) {
        if (!gallery.images.length) return;
        var index = Math.min(Math.max(startIndex || 0, 0), gallery.images.length - 1);
        var panel = $('lightbox');
        var imgEl = $('lightboxImage');
        var counterEl = $('lightboxCounter');
        var prevBtn = $('lightboxPrev');
        var nextBtn = $('lightboxNext');
        var multiple = gallery.images.length > 1;
        prevBtn.hidden = !multiple;
        nextBtn.hidden = !multiple;

        function paint() {
            var image = gallery.images[index];
            imgEl.setAttribute('src', imageUrl(image.url));
            imgEl.setAttribute('alt', isText(image.caption) ? image.caption : altFor(vm, index, gallery.images.length));
            counterEl.textContent = (index + 1) + ' / ' + gallery.images.length;
        }
        function step(delta) {
            index = (index + delta + gallery.images.length) % gallery.images.length;
            paint();
        }

        function onArrow(e) {
            if (!multiple) return;
            if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
        }

        paint();
        var onPrev = function () { step(-1); };
        var onNext = function () { step(1); };
        prevBtn.addEventListener('click', onPrev);
        nextBtn.addEventListener('click', onNext);
        document.addEventListener('keydown', onArrow);

        closeLightboxFn = openDialog(panel, null, trigger, function () {
            prevBtn.removeEventListener('click', onPrev);
            nextBtn.removeEventListener('click', onNext);
            document.removeEventListener('keydown', onArrow);
            closeLightboxFn = null;
            scrollToSlide(index);
        });
    }

    // =====================================================================
    // Contact flow (DB listings)
    //
    // Root-cause note: this used to reveal the advertiser's real number(s)
    // eagerly the moment the sheet/card opened (POST /api/dorms/:id/contact,
    // unauthenticated), then render plain <a href="wa.me/...">/<a href="tel:">
    // anchors - a click just navigated, with zero record of who contacted
    // whom or which channel they actually used. The new flow instead: (1)
    // requires a logged-in student (RMD_AUTH - the canonical auth module,
    // not a new token check), (2) creates a tracked DormInquiry record via
    // POST /api/dorm-inquiries BEFORE opening any channel, keyed to the
    // specific method actually clicked, and (3) only then opens
    // WhatsApp/tel:/mailto: with the inquiry's reference number prefilled.
    // A phone-button click never claims a call was completed - it only
    // records that contact was initiated, same as the other channels.
    // =====================================================================

    function whatsappPrefill(reference, title) {
        return encodeURIComponent(
            'Bonjour, je vous contacte depuis RoastMyDorm concernant « ' + (title || 'ce logement') +
            ' » — référence ' + reference + '. Le logement est-il toujours disponible ?'
        );
    }

    function emailPrefill(reference, title) {
        var subject = encodeURIComponent('RoastMyDorm — ' + (title || 'Logement') + ' — réf. ' + reference);
        var body = encodeURIComponent(
            'Bonjour,\n\nJe vous contacte depuis RoastMyDorm concernant « ' + (title || 'ce logement') +
            ' » — référence ' + reference + '. Le logement est-il toujours disponible ?\n\nMerci.'
        );
        return { subject: subject, body: body };
    }

    // A single client-side guard so a double-click (or a second sheet-open
    // before the first request settles) can never fire two backend calls
    // for the exact same listing+method - on top of, not instead of, the
    // backend's own short duplicate-window dedup.
    var pendingContactKeys = {};

    function contactPhone(value) {
        var digits = String(value || '').replace(/\D/g, '');
        if (digits.indexOf('00') === 0) digits = digits.slice(2);
        if (/^0[5-7]\d{8}$/.test(digits)) digits = '212' + digits.slice(1);
        if (!/^[1-9]\d{7,14}$/.test(digits)) throw new Error('Invalid contact number');
        return digits;
    }

    function contactUrl(method, data, title) {
        if (method === 'whatsapp' && isText(data.whatsapp)) {
            return 'https://wa.me/' + contactPhone(data.whatsapp) + '?text=' + whatsappPrefill(data.uniqueReference, title);
        }
        if (method === 'phone' && isText(data.phone)) return 'tel:+' + contactPhone(data.phone);
        if (method === 'email' && isText(data.email)) {
            var email = data.email.trim();
            if (!/^[^\s@?#]+@[^\s@?#]+\.[^\s@?#]+$/.test(email)) throw new Error('Invalid contact email');
            var prefill = emailPrefill(data.uniqueReference, title);
            return 'mailto:' + encodeURIComponent(email).replace(/%40/g, '@') + '?subject=' + prefill.subject + '&body=' + prefill.body;
        }
        throw new Error('No contact channel available');
    }

    function showContactSuccess(container, reference, url, method) {
        clear(container);
        if (method === 'email') {
            var email = decodeURIComponent(url.slice(7).split('?')[0]);
            var params = new URLSearchParams(url.split('?')[1]);
            container.appendChild(document.createTextNode('Choisissez votre messagerie pour écrire à ' + email + ' : '));
            var gmail = el('a', null, 'Ouvrir Gmail');
            gmail.setAttribute('href', 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(email) +
                '&su=' + encodeURIComponent(params.get('subject') || '') + '&body=' + encodeURIComponent(params.get('body') || ''));
            gmail.setAttribute('target', '_blank');
            gmail.setAttribute('rel', 'noopener noreferrer');
            container.appendChild(gmail);
            container.appendChild(document.createTextNode(' · '));
            var app = el('a', null, 'Utiliser mon application email');
            app.setAttribute('href', url);
            container.appendChild(app);
            container.appendChild(document.createTextNode(' — référence ' + reference + '. Le message reste à envoyer dans votre messagerie.'));
            container.hidden = false;
            return;
        }
        container.appendChild(document.createTextNode('Contact initié — référence ' + reference + '. '));
        var link = el('a', null, method === 'whatsapp' ? 'Ouvrir WhatsApp' : method === 'phone' ? 'Appeler' : 'Ouvrir votre messagerie');
        link.setAttribute('href', url);
        container.appendChild(link);
        if (method !== 'whatsapp') {
            container.appendChild(document.createTextNode(" Si aucune application ne s’ouvre, utilisez ces coordonnées : " +
                (method === 'phone' ? url.slice(4) : decodeURIComponent(url.slice(7).split('?')[0]))));
        }
        container.hidden = false;
    }

    /**
     * Creates the tracked inquiry, then opens the chosen channel. Never
     * opens anything before the backend call resolves successfully, and
     * never opens more than one tab/channel per successful call (a retry
     * after a failure is a brand new click, not an automatic re-open).
     */
    function trackedContact(vm, ctx, method, buttonEl, onError, onSuccess) {
        var key = vm.dormId + ':' + method;
        if (pendingContactKeys[key]) return;

        if (!(window.RMD_AUTH && window.RMD_AUTH.getAccessToken())) {
            window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
            return;
        }

        pendingContactKeys[key] = true;
        var originalHtml = buttonEl ? buttonEl.innerHTML : null;
        if (buttonEl) {
            buttonEl.disabled = true;
            buttonEl.setAttribute('aria-busy', 'true');
        }

        var body = { listingId: vm.dormId, contactMethod: method, sourcePage: window.location.pathname };
        if (ctx.previewToken) body.preview = ctx.previewToken;

        window.RMD_AUTH.authenticatedFetch(API + '/dorm-inquiries', {
            method: 'POST',
            body: JSON.stringify(body),
        })
            .then(function (res) {
                if (res.status === 401) {
                    window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
                    return null;
                }
                return res.json().catch(function () { return null; }).then(function (json) {
                    return { ok: res.ok, json: json };
                });
            })
            .then(function (result) {
                if (!result) return; // redirecting to login
                if (!result.ok || !result.json || !result.json.success || !result.json.data) {
                    throw new Error((result.json && result.json.message) || 'Contact tracking failed');
                }
                var data = result.json.data;
                var url = contactUrl(method, data, vm.title);

                // Keep a real link on the listing for browsers that require a
                // fresh click to launch a phone/mail app after an async request.
                if (onSuccess) onSuccess(data.uniqueReference, url, method);
                // Same-tab navigation needs no popup and never reserves an
                // empty tab while tracking or refreshing the session.
                // Email requires an explicit choice: mailto alone does nothing
                // on devices without a configured mail handler. A real Gmail
                // link also retains the fresh click needed for a new tab.
                if (method !== 'email') window.location.href = url;

                try {
                if (window.RMD && window.RMD.trackOwnerContacted) {
                    window.RMD.trackOwnerContacted({ listingId: vm.id, method: method });
                }
                if (window.RMD && window.RMD.trackFirstParty) {
                    window.RMD.trackFirstParty('contact_initiated', { listingId: vm.dormId });
                }

                } catch (e) { /* Optional analytics must not interrupt contact. */ }
            })
            .catch(function (err) {
                if (onError) onError(err);
            })
            .finally(function () {
                delete pendingContactKeys[key];
                if (buttonEl) {
                    buttonEl.disabled = false;
                    buttonEl.removeAttribute('aria-busy');
                    if (originalHtml !== null) buttonEl.innerHTML = originalHtml;
                }
            });
    }

    function methodButton(opts) {
        var b = el('button', 'btn ' + opts.variant);
        b.setAttribute('type', 'button');
        b.appendChild(opts.brand ? brandIcon(opts.icon) : icon(opts.icon));
        b.appendChild(document.createTextNode(' ' + opts.label));
        return b;
    }

    function openContactSheet(vm, ctx, trigger) {
        var panel = $('contactSheet');
        var methods = $('contactSheetMethods');
        var pending = $('contactSheetPending');
        var errorEl = $('contactSheetError');
        var successEl = $('contactSheetSuccess');
        var advertiserEl = $('contactSheetAdvertiser');

        clear(methods);
        pending.hidden = true;
        errorEl.hidden = true;
        successEl.hidden = true;

        var adv = vm.advertiser || {};
        var advBits = [];
        if (adv.firstName) advBits.push(adv.firstName);
        var typeLabel = formatAdvertiserType(adv.type);
        if (typeLabel) advBits.push(typeLabel);
        if (advBits.length) {
            advertiserEl.textContent = advBits.join(' · ');
            advertiserEl.hidden = false;
        } else {
            advertiserEl.hidden = true;
        }

        var close = openDialog(panel, $('contactSheetBackdrop'), trigger);
        var closeBtn = $('contactSheetClose');
        var onCloseClick = function () { close(); };
        closeBtn.addEventListener('click', onCloseClick, { once: true });

        function showError(message) {
            successEl.hidden = true;
            errorEl.textContent = message;
            errorEl.hidden = false;
        }

        function showSuccess(reference, url, method) {
            errorEl.hidden = true;
            showContactSuccess(successEl, reference, url, method);
        }

        // Render buttons for whichever channels the public payload says
        // exist (no reveal needed for this - hasPhone/hasWhatsapp/hasEmail
        // are plain booleans already in the page's data); when the payload
        // says nothing either way, offer WhatsApp and let the server be
        // authoritative at click time.
        var known = adv.hasPhone || adv.hasWhatsapp || adv.hasEmail;
        var offered = [];
        if (adv.hasWhatsapp || !known) offered.push('whatsapp');
        if (adv.hasPhone) offered.push('phone');
        if (adv.hasEmail) offered.push('email');

        var LABELS = {
            whatsapp: { variant: 'btn-primary', icon: 'fa-whatsapp', brand: true, label: 'WhatsApp' },
            phone: { variant: 'btn-secondary', icon: 'fa-phone', label: 'Appeler' },
            email: { variant: 'btn-outline', icon: 'fa-envelope', label: 'Email' },
        };

        offered.forEach(function (method) {
            var cfg = LABELS[method];
            var btn = methodButton({ variant: cfg.variant, icon: cfg.icon, brand: cfg.brand, label: cfg.label });
            btn.addEventListener('click', function () {
                errorEl.hidden = true;
                successEl.hidden = true;
                trackedContact(vm, ctx, method, btn, function () {
                    showError("Impossible de contacter l'annonceur pour le moment. Réessayez.");
                }, showSuccess);
            });
            methods.appendChild(btn);
        });

        if (!methods.children.length) {
            showError("Aucun moyen de contact n'est disponible pour cette annonce.");
        } else {
            methods.children[0].focus();
        }
    }

    // =====================================================================
    // Report flow (DB listings) — POST /api/reports, login-gated.
    // =====================================================================

    function openReportSheet(vm, ctx, trigger) {
        if (!getToken()) {
            window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
            return;
        }
        var panel = $('reportSheet');
        var form = $('reportForm');
        var errorEl = $('reportError');
        var submitBtn = $('reportSubmit');
        errorEl.hidden = true;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Envoyer';

        var close = openDialog(panel, $('reportSheetBackdrop'), trigger);
        $('reportSheetClose').addEventListener('click', function () { close(); }, { once: true });

        function onSubmit(e) {
            e.preventDefault();
            var checked = form.querySelector('input[name="reportReason"]:checked');
            var reason = checked ? checked.value : 'other';
            if (!REPORT_REASON_LABELS[reason]) reason = 'other';
            var details = $('reportDetails').value.trim();

            submitBtn.disabled = true;
            submitBtn.textContent = 'Envoi…';
            errorEl.hidden = true;

            fetch(API + '/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
                body: JSON.stringify({
                    targetType: 'dorm', targetId: vm.dormId, reason: reason,
                    details: details || undefined,
                }),
            })
                .then(function (res) { return res.json().catch(function () { return null; }); })
                .then(function (json) {
                    if (json && json.success) {
                        form.removeEventListener('submit', onSubmit);
                        close();
                        announce('Signalement envoyé. Merci, notre équipe va l’examiner.');
                        return;
                    }
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Envoyer';
                    errorEl.textContent = (json && json.error) === 'You already have an open report for this'
                        ? 'Vous avez déjà signalé cette annonce.'
                        : "Le signalement n'a pas pu être envoyé. Réessayez dans un instant.";
                    errorEl.hidden = false;
                })
                .catch(function () {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Envoyer';
                    errorEl.textContent = "Le signalement n'a pas pu être envoyé. Réessayez dans un instant.";
                    errorEl.hidden = false;
                });
        }

        form.addEventListener('submit', onSubmit);
    }

    // =====================================================================
    // Sticky bar, favorites, share, back navigation
    // =====================================================================

    function renderContactBar(vm, ctx) {
        var bar = $('contactBar');
        var actions = $('barActions');
        var icons = $('barIcons');
        var notice = $('barDraftNotice');
        var barPrice = $('barPrice');

        if (isNum(vm.price)) {
            $('barPriceValue').textContent = vm.price.toLocaleString('fr-FR') + ' ' + vm.currency;
            barPrice.hidden = false;
        } else {
            barPrice.hidden = true;
        }

        if (vm.isDraft) {
            // Preview-only page: no interactive contact controls at all.
            actions.hidden = true;
            icons.hidden = true;
            notice.hidden = false;
            barPrice.hidden = true;
            bar.hidden = false;
            return;
        }

        actions.hidden = false;
        icons.hidden = false;
        notice.hidden = true;

        var waBtn = $('barWhatsappBtn');
        var contactBtn = $('contactBtn');
        var primaryBtn = $('primaryContactBtn');
        primaryBtn.hidden = false;

        if (vm.source === 'db') {
            // The small WhatsApp-brand icon button implied instant WhatsApp
            // contact - no longer true, so it's hidden for the new flow
            // rather than left showing a stale brand icon for an action that
            // now just opens the same generic request modal as the other
            // two buttons.
            waBtn.hidden = true;
            [contactBtn, primaryBtn].forEach(function (btn) {
                clear(btn);
                btn.appendChild(icon('fa-paper-plane'));
                btn.appendChild(document.createTextNode(' Demander ce logement'));
            });
        } else {
            waBtn.hidden = !(vm.advertiser && vm.advertiser.hasWhatsapp);
        }

        function onContact(trigger) {
            // Same cutover as renderDesktop's contact card below: a Dorm
            // listing opens the new admin-mediated request modal, never the
            // old openContactSheet()/trackedContact() flow (kept unused in
            // this file as a reference for the prior behavior).
            if (vm.source === 'db') {
                if (window.RMD_HOUSING_REQUEST) {
                    window.RMD_HOUSING_REQUEST.openModal({
                        id: vm.dormId,
                        title: vm.title,
                        city: vm.city,
                        neighborhood: vm.neighborhood,
                        price: vm.price,
                        image: (vm.images && vm.images[0]) ? imageUrl(vm.images[0].url) : null,
                    });
                }
            } else {
                openEnquiryModal(vm, trigger);
            }
        }

        contactBtn.addEventListener('click', function () { onContact(contactBtn); });
        primaryBtn.addEventListener('click', function () { onContact(primaryBtn); });
        waBtn.addEventListener('click', function () { onContact(waBtn); });

        bar.hidden = false;
    }

    function initFavorites(vm) {
        var key = 'rmd_favorite_ids';
        var buttons = [$('favBtnTop'), $('favBtnBar')].filter(Boolean);

        function read() {
            try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; }
        }
        function paint() {
            var active = read().indexOf(vm.id) !== -1;
            buttons.forEach(function (b) {
                b.setAttribute('aria-pressed', String(active));
                b.setAttribute('aria-label', active ? 'Retirer des favoris' : 'Ajouter aux favoris');
                var i = b.querySelector('i');
                if (i) i.className = (active ? 'fa-solid' : 'fa-regular') + ' fa-heart';
            });
        }
        function toggle() {
            var favs = read();
            var idx = favs.indexOf(vm.id);
            if (idx === -1) favs.push(vm.id); else favs.splice(idx, 1);
            try { localStorage.setItem(key, JSON.stringify(favs)); } catch (e) { /* private mode */ }
            paint();
        }

        buttons.forEach(function (b) { b.addEventListener('click', toggle); });
        paint();
    }

    function initShare(vm) {
        var buttons = [$('shareBtnHeader'), $('shareBtnGallery')].filter(Boolean);
        buttons.forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var data = { title: vm.title || 'RoastMyDorm', url: window.location.href };
                if (navigator.share) {
                    try { await navigator.share(data); } catch (e) { /* cancelled */ }
                    return;
                }
                try {
                    await navigator.clipboard.writeText(window.location.href);
                    announce('Lien copié !');
                } catch (e) {
                    announce(window.location.href);
                }
            });
        });
    }

    /**
     * The one back-navigation behaviour, shared by the mobile header's back
     * button and the desktop header's "Retour à listings" button: go back when
     * there is real same-origin history to go back to, otherwise fall back to
     * THIS listing's own city page (never a hardcoded city, never a
     * `javascript:` URL).
     */
    function wireBackButton(btn, target) {
        if (!btn) return;
        btn.addEventListener('click', function () {
            var sameOriginReferrer = false;
            try {
                sameOriginReferrer = !!document.referrer &&
                    new URL(document.referrer).origin === window.location.origin;
            } catch (e) { sameOriginReferrer = false; }

            if (window.history.length > 1 && sameOriginReferrer) window.history.back();
            else window.location.href = target;
        });
    }

    function initBackButton(vm) {
        var target = cityPageFor(vm.city);
        $('drawerCityLink').setAttribute('href', target);
        wireBackButton($('backBtn'), target);
        wireBackButton($('dtBackBtn'), target);
    }

    function initDrawer() {
        var drawer = $('mobileDrawer');
        var btn = $('mobileMenuBtn');
        function open() { drawer.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
        function close() { drawer.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
        btn.addEventListener('click', open);
        $('mobileDrawerBackdrop').addEventListener('click', close);
        $('mobileDrawerClose').addEventListener('click', close);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && drawer.classList.contains('open')) close();
        });
    }

    // =====================================================================
    // Legacy static-dataset enquiry flow — preserved as-is.
    // =====================================================================

    function openEnquiryModal(vm, trigger) {
        if (!getToken()) {
            window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.href);
            return;
        }
        var modal = $('enquireModal');
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        var closeBtn = $('modalCloseBtn');

        function close() {
            modal.classList.remove('show');
            document.body.style.overflow = '';
            document.removeEventListener('keydown', onKey);
            if (trigger && trigger.focus) trigger.focus();
        }
        function onKey(e) { if (e.key === 'Escape') close(); }

        closeBtn.addEventListener('click', close, { once: true });
        modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
        document.addEventListener('keydown', onKey);
        closeBtn.focus();
    }

    function initEnquiryForm(vm) {
        var form = $('enquireForm');
        if (!form) return;
        var listing = {
            name: vm.title || 'Logement étudiant',
            rent: isNum(vm.price) ? (vm.price.toLocaleString('fr-FR') + ' ' + vm.currency + ' / mois') : 'Prix non précisé',
            url: vm.url,
        };

        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            var name = $('enq-name').value.trim();
            var email = $('enq-email').value.trim();
            var phone = $('enq-phone').value.trim();
            var message = $('enq-message').value.trim();
            if (!name || !email || !phone) return;

            var submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Envoi…';

            try {
                await fetch(API + '/enquiries/confirm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        clientName: name, clientEmail: email, clientPhone: phone,
                        countryCode: '+212', message: message, preferredContact: 'whatsapp', listing: listing,
                    }),
                });
            } catch (err) { /* resolved client-side via WhatsApp below */ }

            if (window.RMD && window.RMD.trackOwnerContacted) {
                window.RMD.trackOwnerContacted({ listingId: vm.id, method: 'whatsapp' });
            }

            var waText = encodeURIComponent(
                'Bonjour ' + name + ' ! Votre demande pour « ' + listing.name + ' » a bien été reçue.\n' +
                'Loyer : ' + listing.rent + '\n' + listing.url);

            clear(form);
            var done = el('div');
            done.style.textAlign = 'center';
            done.appendChild(el('p', null, 'Demande envoyée !'));
            done.appendChild(el('p', 'pd-advertiser-meta', 'Confirmation envoyée à ' + email + '.'));
            var wa = el('a', 'btn btn-primary btn-block');
            wa.setAttribute('href', 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + waText);
            wa.setAttribute('target', '_blank');
            wa.setAttribute('rel', 'noopener');
            wa.appendChild(brandIcon('fa-whatsapp'));
            wa.appendChild(document.createTextNode('Continuer sur WhatsApp'));
            done.appendChild(wa);
            form.appendChild(done);
        });
    }

    // =====================================================================
    // DESKTOP PRESENTATION (>= 768px)
    //
    // The restored original desktop page (frontend/property.html) rendered
    // into the second markup tree that ships alongside the mobile one. It is
    // driven by the SAME view-model the mobile renderers use: there is exactly
    // one network request for the listing (loadProperty) and one adapter
    // (adaptDorm / adaptStaticProperty). Nothing here re-fetches or re-adapts.
    //
    // One deliberate deviation from a verbatim port: property.html carried its
    // own `amenityIcons` / `amenityLabels` maps, but every key they hold is
    // already covered — in French, for all 25 Dorm.amenities enum values plus
    // the legacy static vocabulary — by AMENITY_LABELS / AMENITY_ICONS at the
    // top of this file, which the view-model has already resolved into
    // vm.amenities. Porting the second pair would leave two sources of truth
    // for the same enum, so the desktop renders vm.amenities directly.
    //
    // Second deviation: no value is ever printed as an em-dash placeholder.
    // property.html's spec grid emitted "—" for every field the record does not
    // have; here a missing field simply omits its card, and a section with no
    // cards left hides entirely — the same discipline the mobile block uses.
    // =====================================================================

    var dtGallery = { images: [], index: 0 };

    function dtShow(id, visible) {
        var node = $(id);
        if (node) node.hidden = !visible;
    }

    function dtBackgroundImage(node, url) {
        // JSON.stringify quotes and escapes the value, so a URL can never break
        // out of the url() token.
        node.style.backgroundImage = 'url(' + JSON.stringify(url) + ')';
    }

    function renderDesktopGallery(vm) {
        var wrap = $('dtGalleryMain');
        clear(wrap);

        var urls = (vm.images || []).map(function (i) { return imageUrl(i.url); }).filter(Boolean);
        dtGallery.images = urls;
        dtGallery.index = 0;

        if (!urls.length) {
            var empty = el('div', 'dt-main-image dt-no-photo');
            empty.appendChild(icon('fa-home'));
            wrap.appendChild(empty);
            return;
        }

        var main = el('div', 'dt-main-image');
        dtBackgroundImage(main, urls[0]);
        main.setAttribute('role', 'button');
        main.setAttribute('tabindex', '0');
        main.setAttribute('aria-label', altFor(vm, 0, urls.length));
        main.addEventListener('click', function () { openDesktopLightbox(0); });
        main.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDesktopLightbox(0); }
        });

        if (urls.length > 1) {
            var viewAll = el('button', 'dt-view-all-btn');
            viewAll.type = 'button';
            viewAll.appendChild(icon('fa-images'));
            viewAll.appendChild(document.createTextNode(' Voir les ' + urls.length + ' photos'));
            viewAll.addEventListener('click', function (e) {
                e.stopPropagation();
                openDesktopLightbox(0);
            });
            main.appendChild(viewAll);
        }
        wrap.appendChild(main);

        var thumbUrls = urls.slice(1, 3);
        if (thumbUrls.length) {
            var strip = el('div', 'dt-thumbnails');
            thumbUrls.forEach(function (url, i) {
                var thumb = el('button', 'dt-thumbnail');
                thumb.type = 'button';
                thumb.setAttribute('aria-label', 'Voir la photo ' + (i + 2));
                dtBackgroundImage(thumb, url);
                thumb.addEventListener('click', function () { openDesktopLightbox(i + 1); });
                strip.appendChild(thumb);
            });
            wrap.appendChild(strip);
        }
    }

    function paintDesktopLightbox() {
        $('dtLbImg').setAttribute('src', dtGallery.images[dtGallery.index]);
        $('dtLbCounter').textContent = (dtGallery.index + 1) + ' / ' + dtGallery.images.length;
    }

    function desktopLightboxStep(delta) {
        if (dtGallery.images.length < 2) return;
        dtGallery.index = (dtGallery.index + delta + dtGallery.images.length) % dtGallery.images.length;
        paintDesktopLightbox();
    }

    function openDesktopLightbox(index) {
        if (!dtGallery.images.length) return;
        dtGallery.index = Math.min(Math.max(index || 0, 0), dtGallery.images.length - 1);
        paintDesktopLightbox();
        var multiple = dtGallery.images.length > 1;
        $('dtLbPrev').hidden = !multiple;
        $('dtLbNext').hidden = !multiple;
        $('dtLightbox').classList.add('dt-open');
        $('dtLbClose').focus();
    }

    function closeDesktopLightbox() {
        $('dtLightbox').classList.remove('dt-open');
    }

    function initDesktopLightbox() {
        var box = $('dtLightbox');
        if (!box) return;
        $('dtLbClose').addEventListener('click', closeDesktopLightbox);
        $('dtLbPrev').addEventListener('click', function () { desktopLightboxStep(-1); });
        $('dtLbNext').addEventListener('click', function () { desktopLightboxStep(1); });
        box.addEventListener('click', function (e) { if (e.target === box) closeDesktopLightbox(); });
        document.addEventListener('keydown', function (e) {
            if (!box.classList.contains('dt-open')) return;
            if (e.key === 'Escape') closeDesktopLightbox();
            else if (e.key === 'ArrowLeft') desktopLightboxStep(-1);
            else if (e.key === 'ArrowRight') desktopLightboxStep(1);
        });
    }

    function renderDesktopHeadline(vm) {
        $('dtPropTitle').textContent = vm.title || 'Logement étudiant';

        var placeParts = [];
        if (vm.neighborhood) placeParts.push(vm.neighborhood);
        if (vm.city) placeParts.push(capitalize(vm.city));
        var subtitle = $('dtPropSubtitle');
        if (placeParts.length) {
            subtitle.textContent = placeParts.concat('Maroc').join(', ');
            subtitle.hidden = false;
        } else {
            subtitle.hidden = true;
        }

        if (isNum(vm.price)) {
            $('dtPropPrice').textContent = vm.price.toLocaleString('fr-FR') + ' ' + vm.currency;
            $('dtPriceTag').hidden = false;
            $('dtWidgetPrice').textContent = vm.price.toLocaleString('fr-FR') + ' ' + vm.currency;
            $('dtWidgetPrice').hidden = false;
            $('dtWidgetPriceInfo').hidden = false;
        } else {
            $('dtPriceTag').hidden = true;
            $('dtWidgetPrice').hidden = true;
            $('dtWidgetPriceInfo').hidden = true;
        }

        var meta = $('dtPropMeta');
        clear(meta);
        function metaItem(iconName, text) {
            var div = el('div', 'dt-metadata-item');
            div.appendChild(icon(iconName));
            div.appendChild(document.createTextNode(text));
            meta.appendChild(div);
        }
        if (placeParts.length) metaItem('fa-location-dot', placeParts.join(', '));
        var typeLabel = formatPropertyType(vm.propertyType);
        if (typeLabel) metaItem(propertyTypeIcon(vm.propertyType), typeLabel);
        if (isFurnished(vm)) metaItem('fa-couch', 'Meublé');
    }

    function renderDesktopSpecs(vm) {
        var grid = $('dtSpecsGrid');
        clear(grid);

        var specs = [];
        if (isNum(vm.bedrooms) && vm.bedrooms > 0) specs.push({ icon: 'fa-bed', label: 'Chambres', value: String(vm.bedrooms) });
        if (isNum(vm.bathrooms) && vm.bathrooms > 0) specs.push({ icon: 'fa-bath', label: 'Salles de bain', value: String(vm.bathrooms) });
        if (isNum(vm.squareFootage) && vm.squareFootage > 0) specs.push({ icon: 'fa-vector-square', label: 'Superficie', value: vm.squareFootage + ' m²' });
        if (isFurnished(vm)) specs.push({ icon: 'fa-couch', label: 'Meublé', value: 'Oui' });
        if (vm.availability) {
            var minStay = formatMonths(vm.availability.minimumStay);
            if (minStay && vm.availability.minimumStay > 1) {
                specs.push({ icon: 'fa-file-contract', label: 'Durée du bail', value: minStay + ' minimum' });
            }
            var from = formatDate(vm.availability.availableFrom);
            if (from) specs.push({ icon: 'fa-calendar-day', label: 'Disponible', value: from });
        }
        if (vm.colocation && isNum(vm.colocation.currentRoommates)) {
            specs.push({
                icon: 'fa-users', label: 'Colocataires',
                value: String(vm.colocation.currentRoommates),
            });
        }

        specs.forEach(function (s) {
            var card = el('div', 'dt-spec-card');
            card.appendChild(icon(s.icon));
            card.appendChild(el('div', 'dt-spec-label', s.label));
            card.appendChild(el('div', 'dt-spec-value', s.value));
            grid.appendChild(card);
        });

        dtShow('dtSpecsSection', specs.length > 0);
    }

    function renderDesktopAmenities(vm) {
        var grid = $('dtAmenitiesGrid');
        clear(grid);
        var items = (vm.amenities || []).filter(function (a) { return a && isText(a.label); });
        items.forEach(function (a) {
            var item = el('div', 'dt-amenity-item');
            item.appendChild(icon(a.icon));
            item.appendChild(document.createTextNode(a.label));
            grid.appendChild(item);
        });
        dtShow('dtAmenitiesSection', items.length > 0);
    }

    function renderDesktopSimilar(vm) {
        var grid = $('dtSimilarGrid');
        clear(grid);
        var items = vm.similar || [];
        items.forEach(function (item) {
            var a = el('a', 'dt-similar-card');
            a.setAttribute('href', '/logement/' + encodeURIComponent(item.slug));

            var media = el('div', 'dt-similar-media');
            var firstImage = orderImages(item.images)[0];
            var src = firstImage ? imageUrl(firstImage.url) : null;
            if (src) dtBackgroundImage(media, src);
            else media.appendChild(icon('fa-image'));
            a.appendChild(media);

            var body = el('div', 'dt-similar-body');
            body.appendChild(el('div', 'dt-similar-title', isText(item.name) ? item.name : 'Logement'));
            var addr = (item.location && item.location.address) || {};
            var bits = [];
            if (isText(addr.neighborhood)) bits.push(addr.neighborhood);
            if (isText(addr.city)) bits.push(capitalize(addr.city));
            if (bits.length) body.appendChild(el('div', 'dt-similar-place', bits.join(', ')));
            var rent = item.pricing && item.pricing.baseRent;
            if (isNum(rent)) body.appendChild(el('div', 'dt-similar-price', rent.toLocaleString('fr-FR') + ' MAD / mois'));
            a.appendChild(body);

            grid.appendChild(a);
        });
        dtShow('dtSimilarSection', items.length > 0);
    }

    /**
     * The desktop contact card's Call / WhatsApp buttons. Exactly the gated
     * flow property.html used: the advertiser's number is never in the page
     * source, it is fetched on click from POST /api/dorms/:id/contact (with the
     * admin preview token passed through when the page is a draft preview,
     * matching the mobile contact sheet).
     */
    function wireDesktopContact(vm, ctx) {
        var callBtn = $('dtBtnCall');
        var waBtn = $('dtBtnWhatsapp');
        var emailBtn = $('dtBtnEmail');
        var errorEl = $('dtContactError');
        var successEl = $('dtContactSuccess');
        var rows = $('dtLandlordRows');
        clear(rows);

        var adv = vm.advertiser || {};
        var name = adv.firstName || 'Annonceur';
        var nameRow = el('div', 'dt-landlord-row');
        nameRow.appendChild(icon('fa-user'));
        nameRow.appendChild(document.createTextNode(name));
        rows.appendChild(nameRow);

        // Deliberately just the advertiser's name, exactly as the original
        // card did — the real contact channel is never in the page source.

        // A draft preview is look-only: no contact controls at all.
        if (vm.isDraft) {
            callBtn.hidden = true;
            waBtn.hidden = true;
            emailBtn.hidden = true;
            return;
        }

        if (vm.source !== 'db') {
            // Legacy static dataset: no per-listing advertiser number exists,
            // so the same enquiry flow the mobile block uses is offered.
            // Untouched - this is the legacy/PropertyRequest email-inquiry
            // path, deliberately not part of the new tracked flow.
            callBtn.hidden = true;
            emailBtn.hidden = true;
            waBtn.hidden = false;
            clear(waBtn);
            waBtn.appendChild(icon('fa-comment-dots'));
            waBtn.appendChild(document.createTextNode(' Contacter maintenant'));
            waBtn.classList.remove('dt-whatsapp');
            waBtn.addEventListener('click', function () { openEnquiryModal(vm, waBtn); });
            return;
        }

        // ====================================================================
        // Admin-mediated flow cutover: a Dorm listing (vm.source === 'db') no
        // longer offers direct call/WhatsApp/email buttons that reveal the
        // landlord's contact info and open wa.me:/tel:/mailto: (that was
        // trackedContact()/openWith() above - kept in this file, unused from
        // here, only as a reference for what the legacy behavior was).
        // Instead, one button opens the new admin-mediated request modal
        // (js/housing-request-widget.js) - no contact detail is ever
        // revealed to the student until an admin verifies availability AND
        // the student separately consents to sharing their own info.
        // ====================================================================
        callBtn.hidden = true;
        emailBtn.hidden = true;
        waBtn.hidden = false;
        clear(waBtn);
        waBtn.appendChild(icon('fa-paper-plane'));
        waBtn.appendChild(document.createTextNode(' Demander ce logement'));
        waBtn.classList.remove('dt-whatsapp');
        waBtn.addEventListener('click', function () {
            if (!(window.RMD_HOUSING_REQUEST)) return;
            window.RMD_HOUSING_REQUEST.openModal({
                id: vm.dormId,
                title: vm.title,
                city: vm.city,
                neighborhood: vm.neighborhood,
                price: vm.price,
                image: (vm.images && vm.images[0]) ? imageUrl(vm.images[0].url) : null,
            });
        });
    }

    function renderDesktop(vm, ctx) {
        var cityPage = cityPageFor(vm.city);

        // Breadcrumb + both "more listings" affordances point at THIS listing's
        // own city page, never a hardcoded one.
        var cityLink = $('dtBreadcrumbCity');
        cityLink.setAttribute('href', cityPage);
        cityLink.textContent = vm.city ? ('Logements à ' + capitalize(vm.city)) : 'Logements';
        $('dtBreadcrumbTitle').textContent = vm.title || 'Logement';
        var more = $('dtMoreListings');
        more.setAttribute('href', cityPage);
        clear(more);
        more.appendChild(icon('fa-magnifying-glass'));
        more.appendChild(document.createTextNode(
            vm.city ? (' Voir les logements à ' + capitalize(vm.city)) : " Voir d'autres logements"));

        renderDesktopGallery(vm);
        renderDesktopHeadline(vm);
        renderDesktopSpecs(vm);
        renderDesktopAmenities(vm);

        if (vm.description) {
            $('dtPropDesc').textContent = vm.description;
            dtShow('dtDescSection', true);
        } else {
            dtShow('dtDescSection', false);
        }

        renderDesktopSimilar(vm);

        // Verified badge only when the record actually says so.
        dtShow('dtVerifiedBadge', vm.verified === true);
        dtShow('dtDraftBadge', vm.isDraft === true);

        wireDesktopContact(vm, ctx);
        initDesktopLightbox();

        $('dtLoadingState').hidden = true;
        $('dtErrorState').hidden = true;
        $('dtContent').hidden = false;
    }

    function showDesktopNotFound() {
        $('dtLoadingState').hidden = true;
        $('dtContent').hidden = true;
        $('dtErrorState').hidden = false;
    }

    // =====================================================================
    // SEO
    // =====================================================================

    function updateSEO(vm) {
        if (typeof updateMetaTags !== 'function') return;

        var placeBits = [vm.neighborhood, vm.city ? capitalize(vm.city) : null].filter(Boolean);
        var typeLabel = formatPropertyType(vm.propertyType);
        var descBits = [];
        if (vm.description) descBits.push(vm.description.replace(/\s+/g, ' ').trim());
        else {
            if (typeLabel) descBits.push(typeLabel);
            if (placeBits.length) descBits.push('à ' + placeBits.join(', '));
            if (isNum(vm.price)) descBits.push('— ' + vm.price.toLocaleString('fr-FR') + ' ' + vm.currency + ' / mois');
        }
        var description = descBits.join(' ').slice(0, 155) ||
            'Logement étudiant vérifié sur RoastMyDorm.';

        var cover = vm.images && vm.images.length ? absoluteUrl(vm.images[0].url) : null;

        // Single source of truth for robots: a draft preview is noindex through
        // the same call, never a separate order-dependent override afterwards.
        updateMetaTags({
            title: vm.title || 'Logement étudiant',
            description: description,
            canonicalUrl: vm.url,
            ogImage: cover || undefined,
            ogType: 'article',
            noindex: vm.isDraft,
        });

        if (typeof addStructuredData !== 'function') return;

        var accommodation = {
            '@context': 'https://schema.org',
            '@type': 'Accommodation',
            name: vm.title || undefined,
            url: vm.url,
        };
        if (vm.description) accommodation.description = vm.description;
        if (cover) accommodation.image = vm.images.map(function (i) { return absoluteUrl(i.url); }).filter(Boolean);
        if (isNum(vm.bedrooms)) accommodation.numberOfRooms = vm.bedrooms;
        if (isNum(vm.bathrooms)) accommodation.numberOfBathroomsTotal = vm.bathrooms;
        if (isNum(vm.squareFootage)) {
            accommodation.floorSize = { '@type': 'QuantitativeValue', value: vm.squareFootage, unitCode: 'MTK' };
        }
        if (vm.city || vm.neighborhood) {
            accommodation.address = { '@type': 'PostalAddress', addressCountry: 'MA' };
            if (vm.city) accommodation.address.addressLocality = capitalize(vm.city);
            if (vm.neighborhood) accommodation.address.addressRegion = vm.neighborhood;
        }
        if (isNum(vm.price)) {
            accommodation.offers = {
                '@type': 'Offer',
                price: vm.price,
                priceCurrency: vm.currency,
                availability: (vm.availability && vm.availability.isAvailable === false)
                    ? 'https://schema.org/OutOfStock'
                    : 'https://schema.org/InStock',
                url: vm.url,
            };
        }
        addStructuredData(accommodation);

        if (typeof generateBreadcrumbs === 'function') {
            var crumbs = [{ name: 'Accueil', url: '/index.html' }];
            if (vm.city) crumbs.push({ name: capitalize(vm.city), url: cityPageFor(vm.city) });
            crumbs.push({ name: vm.title || 'Logement', url: vm.url });
            addStructuredData(generateBreadcrumbs(crumbs));
        }
    }

    // =====================================================================
    // Boot
    // =====================================================================

    async function init() {
        initDrawer();

        var result = await loadProperty();
        var vm = result.vm;
        $('loadingState').hidden = true;

        if (result.redirectTo) {
            // The slug changed since this link was shared — replace() so the
            // dead slug doesn't linger in history.
            window.location.replace(result.redirectTo + window.location.search);
            return;
        }

        if (!vm) {
            // ONE state machine, two presentations: the loading / not-found /
            // loaded decision is made exactly once here and applied to both
            // markup trees together, so they can never disagree. Each tree
            // keeps its own state markup because each has its own visual
            // language (mobile skeleton vs. the original desktop spinner) —
            // sharing a single node would show the mobile skeleton at 1440px.
            $('notFoundState').hidden = false;
            showDesktopNotFound();
            document.title = 'Logement introuvable | RoastMyDorm';
            if (typeof updateOrCreateMeta === 'function') updateOrCreateMeta('robots', 'noindex, follow');
            return;
        }

        var ctx = { previewToken: result.previewToken || null };

        // Listing identification for analytics (see js/analytics.js's
        // currentListingId()): only ever the real Dorm _id, never a slug -
        // vm.dormId is already null for the ~150 legacy static listings
        // (adaptStaticProperty() never sets it), which is exactly the
        // signal used here to skip a listingId for those rather than
        // sending something that isn't a valid Mongo ObjectId.
        if (vm.dormId) {
            window.__RMD_CURRENT_LISTING_ID__ = vm.dormId;
            if (!vm.isDraft && window.RMD && window.RMD.trackFirstParty) {
                window.RMD.trackFirstParty('listing_view', { listingId: vm.dormId });
            }
        }

        $('draftBanner').hidden = !vm.isDraft;

        renderGallery(vm);
        renderBadges(vm);
        renderHeadline(vm);
        renderChips(vm);
        renderDescription(vm);
        renderVideos(vm);
        renderCosts(vm);
        renderColocation(vm);
        renderAmenities(vm);
        renderLocation(vm);
        renderAdvertiser(vm, ctx);
        renderSimilar(vm);
        renderContactBar(vm, ctx);

        // Same view-model, second markup tree — the restored desktop layout.
        renderDesktop(vm, ctx);

        initFavorites(vm);
        initShare(vm);
        initBackButton(vm);
        initEnquiryForm(vm);
        updateSEO(vm);

        $('propertyDetail').hidden = false;

        if (window.RMD && window.RMD.trackListingViewed) {
            window.RMD.trackListingViewed({
                listingId: vm.id, city: vm.city, propertyType: vm.propertyType,
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
