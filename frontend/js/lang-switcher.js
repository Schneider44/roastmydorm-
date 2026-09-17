/**
 * RoastMyDorm — Language Switcher (EN / FR / AR)
 * Injects a navbar dropdown. Applies translations to text nodes + key
 * attributes at runtime. Arabic mode also sets dir="rtl". Preference in localStorage.
 */
(function () {
  'use strict';

  // ── Translation pairs (longest-first, HTML-tag-free, text-node safe) ────────
  var T = [
    // Page / meta
    ['Student Housing in Morocco', 'Logement étudiant au Maroc'],
    ['Student Housing near', 'Logement étudiant près de'],
    ['Find Student Housing', 'Trouver un logement étudiant'],
    ['Student Housing', 'Logement étudiant'],
    ['Rentals & Reviews', 'Locations & Avis'],
    ['Honest Reviews', 'Avis honnêtes'],
    ['Verified Rentals', 'Locations vérifiées'],
    ['Near Your University', 'Près de votre université'],
    ['near your university', 'près de votre université'],
    ['Browse verified student apartments', 'Parcourez des appartements étudiants vérifiés'],
    ['student apartments, studios and rooms', 'appartements, studios et chambres étudiants'],

    // Navigation
    ['How It Works', 'Comment ça marche'],
    ['For Landlords', 'Pour les propriétaires'],
    ['Find Your Roommate', 'Trouver un colocataire'],
    ['Find Roommate', 'Trouver un colocataire'],
    ['Sign In', 'Se connecter'],
    ['Sign Up', "S'inscrire"],
    ['Log In', 'Se connecter'],
    ['Log Out', 'Déconnexion'],
    ['Logout', 'Déconnexion'],
    ['My Account', 'Mon compte'],
    ['My Profile', 'Mon profil'],
    ['Dashboard', 'Tableau de bord'],

    // Hero
    ['Find Your Room. Find Your Roommate,', 'Trouvez votre chambre. Trouvez votre colocataire,'],
    ['Rent with Confidence', 'Louez en toute confiance'],
    ['Verified dorms, studios & shared apartments for students across Morocco.', 'Résidences, studios et appartements partagés vérifiés pour les étudiants au Maroc.'],
    ['Search universities and schools', 'Rechercher des universités et écoles'],
    ['Search Universities', 'Rechercher des universités'],
    ['For Students', 'Pour les étudiants'],
    ['Dormitories', 'Résidences'],
    ['in Morocco', 'au Maroc'],

    // City cards
    ['verified dorms available - Near', 'logements vérifiés - Près de'],
    ['verified dorms available  - Near', 'logements vérifiés - Près de'],
    ['verified dorms available', 'logements vérifiés disponibles'],
    ['Avg Rent:', 'Loyer moyen :'],
    ['Rating:', 'Note :'],

    // Browse by University
    ['Campus Housing', 'Logement sur le campus'],
    ['Browse by University', 'Parcourir par université'],
    ['Find verified student housing near your campus — dorms, studios & shared apartments across Morocco.', 'Trouvez des logements étudiants vérifiés près de votre campus — résidences, studios et appartements partagés au Maroc.'],
    ['listings nearby', 'annonces à proximité'],
    ['listing nearby', 'annonce à proximité'],
    ['View all universities', 'Voir toutes les universités'],
    ['View All Universities', 'Voir toutes les universités'],

    // For Students section
    ["Find your perfect student home in Morocco's top cities", 'Trouvez votre logement étudiant idéal dans les meilleures villes du Maroc'],
    ['City Selection', 'Choix de la ville'],
    ['Choose from Casablanca, Rabat, and Marrakech', 'Choisissez entre Casablanca, Rabat et Marrakech'],
    ['Dorm Listings', 'Annonces de logements'],
    ['Browse available dorms with photos and details', 'Parcourez les logements disponibles avec photos et détails'],
    ['Payment Options', 'Options de paiement'],
    ['Face-to-Face payment arrangements', 'Paiement en personne'],
    ['Direct Contact', 'Contact direct'],
    ['Connect directly with landlords', 'Contactez directement les propriétaires'],

    // How It Works
    ['Browse Listings', 'Parcourir les annonces'],
    ['Browse listings', 'Parcourir les annonces'],
    ['Contact Landlord', 'Contacter le propriétaire'],
    ['Schedule a Visit', 'Planifier une visite'],
    ['Find your perfect room', 'Trouvez votre logement idéal'],
    ['Browse through our verified listings', 'Parcourez nos annonces vérifiées'],
    ['Reach out to landlords directly', 'Contactez directement les propriétaires'],
    ['Set up a viewing at your convenience', 'Organisez une visite à votre convenance'],
    ['Sign your lease and move in', 'Signez votre bail et emménagez'],

    // Gallery
    ['View All Photos (', 'Voir les photos ('],
    ['View All Photos', 'Voir toutes les photos'],
    ['All Photos', 'Toutes les photos'],

    // Title section
    ['View on Map', 'Voir sur la carte'],
    ['(1 review)', '(1 avis)'],
    ['No reviews yet. Be the first to share your experience!', "Pas encore d'avis. Soyez le premier à partager votre expérience !"],
    ['No reviews', 'Aucun avis'],
    [' reviews)', ' avis)'],
    ['reviews)', 'avis)'],
    ['/month', '/mois'],
    ['per month', 'par mois'],
    ['Per month', 'Par mois'],
    ['Per Month', 'Par mois'],
    ['utilities included', 'charges comprises'],
    ['Utilities Included', 'Charges comprises'],

    // Specs
    ['Key Specifications', 'Caractéristiques principales'],
    ['Key specifications', 'Caractéristiques principales'],
    ['Property Details', 'Détails du logement'],
    ['Quick Facts', 'Informations clés'],
    ['Square Footage', 'Surface'],
    ['square footage', 'surface'],
    ['sq ft', 'm²'],
    ['sq m', 'm²'],
    ['Bedrooms', 'Chambres'],
    ['Bedroom', 'Chambre'],
    ['Bathrooms', 'Salles de bain'],
    ['Bathroom', 'Salle de bain'],
    ['Ensuite', 'Salle de bain privée'],
    ['ensuite', 'salle de bain privée'],
    ['Move-In', 'Emménagement'],
    ['Move-in', 'Emménagement'],
    ['Move In', 'Emménager'],
    ['Unfurnished', 'Non meublé'],
    ['Furnished', 'Meublé'],
    ['Available From', 'Disponible à partir du'],
    ['Available from', 'Disponible à partir du'],
    ['All genders welcome', 'Tous genres bienvenus'],
    ['Min. Stay', 'Durée min.'],
    ['12 Months', '12 mois'],
    ['6 Months', '6 mois'],
    ['Lease', 'Durée du bail'],

    // Amenities
    ['High-Speed Wi-Fi', 'Wi-Fi haut débit'],
    ['High Speed Wi-Fi', 'Wi-Fi haut débit'],
    ['Fitness Center Access', 'Accès salle de sport'],
    ['Fitness Center', 'Salle de sport'],
    ['In-unit Laundry', 'Lave-linge dans le logement'],
    ['In-Unit Laundry', 'Lave-linge dans le logement'],
    ['24/7 Security', 'Sécurité 24h/24'],
    ['Air Conditioning', 'Climatisation'],
    ['Parking Available', 'Parking disponible'],
    ['Smart TV Included', 'Télévision intelligente incluse'],
    ['Smart TV', 'Télévision intelligente'],
    ['Fully Equipped Kitchen', 'Cuisine entièrement équipée'],
    ['Equipped Kitchen', 'Cuisine équipée'],
    ['Rooftop Access', 'Accès toit-terrasse'],
    ['Swimming Pool', 'Piscine'],
    ['Garden Access', 'Accès jardin'],
    ["Study Room", "Salle d'étude"],
    ['Common Area', 'Espace commun'],
    ['Water Heater', 'Chauffe-eau'],
    ['Washing Machine', 'Lave-linge'],
    ['Dishwasher', 'Lave-vaisselle'],
    ['Refrigerator', 'Réfrigérateur'],
    ['Microwave', 'Micro-ondes'],
    ['Elevator', 'Ascenseur'],
    ['Balcony', 'Balcon'],
    ['Terrace', 'Terrasse'],
    ['Heating', 'Chauffage'],
    ['Dryer', 'Sèche-linge'],

    // What's Included
    ["What's Included", 'Ce qui est inclus'],

    // Amenities label
    ['Amenities', 'Équipements'],

    // Description
    ['About This Space', 'À propos de ce logement'],
    ['About This Property', 'À propos de ce bien'],
    ['About this space', 'À propos de ce logement'],
    ['About this property', 'À propos de ce bien'],
    ['View Full Map', 'Voir la carte complète'],
    ['min walk to', 'min à pied de'],
    ['min walk', 'min à pied'],
    ['minutes walk', 'minutes à pied'],
    ['minute walk', 'minutes à pied'],
    ['Walkability:', 'Accessibilité à pied :'],
    ['Located in a vibrant neighborhood', 'Situé dans un quartier animé'],
    ['Located in a quiet', 'Situé dans un quartier calme'],
    ['easy access to', 'accès facile à'],
    ['public transportation', 'les transports en commun'],
    ['grocery stores', 'épiceries'],
    ['Nearby amenities', 'Commodités à proximité'],
    ['nearby amenities', 'commodités à proximité'],
    ['main campus', 'campus principal'],

    // Reviews
    ['Student Reviews', 'Avis des étudiants'],
    ['Student reviews', 'Avis des étudiants'],
    ['Write a Review', 'Laisser un avis'],
    ['Leave a Review', 'Laisser un avis'],
    ['Submit Review', "Soumettre l'avis"],
    ['Your Review', 'Votre avis'],
    ['Overall Rating', 'Note globale'],
    ['Location Rating', "Note d'emplacement"],
    ['Value Rating', 'Rapport qualité/prix'],
    ['Cleanliness', 'Propreté'],
    ['Read all reviews', 'Lire tous les avis'],
    ['See all reviews', 'Voir tous les avis'],

    // Booking widget
    ['Verified Listing', 'Annonce vérifiée'],
    ['Verified listing', 'Annonce vérifiée'],
    ['Enquire Now', 'Contacter maintenant'],
    ['Contact Now', 'Contacter maintenant'],
    ['Book Now', 'Réserver maintenant'],
    ['Request Info', 'Demander des informations'],
    ['Verified property', 'Logement vérifié'],
    ['Verified Property', 'Logement vérifié'],
    ['Direct landlord contact', 'Contact direct avec le propriétaire'],
    ["No agency fees", "Sans frais d'agence"],
    ["No Agency Fees", "Sans frais d'agence"],
    ['Available Now', 'Disponible maintenant'],
    ['Contact via WhatsApp', 'Contacter via WhatsApp'],

    // Enquiry modal
    ['Your Full Name *', 'Votre nom complet *'],
    ['Your Full Name', 'Votre nom complet'],
    ['Full Name', 'Nom complet'],
    ['Your Email *', 'Votre email *'],
    ['Your Email', 'Votre email'],
    ['Your Phone Number (WhatsApp) *', 'Votre numéro (WhatsApp) *'],
    ['Your Phone Number (WhatsApp)', 'Votre numéro (WhatsApp)'],
    ['Your Phone Number', 'Votre numéro de téléphone'],
    ['Your Message', 'Votre message'],
    ['i.e. Hello, I am a student', 'Ex. Bonjour, je suis étudiant(e)'],
    ['Send Enquiry', 'Envoyer la demande'],
    ['Send enquiry', 'Envoyer la demande'],
    ['Send Message', 'Envoyer le message'],

    // Footer
    ['All rights reserved', 'Tous droits réservés'],
    ['Privacy Policy', 'Politique de confidentialité'],
    ["Terms & Conditions", "Conditions d'utilisation"],
    ['Terms of Service', "Conditions d'utilisation"],
    ['Contact Us', 'Nous contacter'],
    ['About Us', 'À propos de nous'],
    ['Quick Links', 'Liens rapides'],
    ['Follow Us', 'Suivez-nous'],
    ['Get the latest listings', 'Recevez les dernières annonces'],
    ["Subscribe", "S'abonner"],

    // Common property labels
    ['Verified Rentals', 'Locations vérifiées'],
    ['Not Available', 'Non disponible'],
    ['Available', 'Disponible'],
    ['Shared Apartment', 'Appartement partagé'],
    ['Shared Room', 'Chambre partagée'],
    ['Shared Studio', 'Studio partagé'],
    ['Near University', "Proche de l'université"],
    ['Near university', "Proche de l'université"],
    ['Nearby Universities', 'Universités à proximité'],
    ['Apartment', 'Appartement'],

    // UI actions
    ['Browse All Listings', 'Voir toutes les annonces'],
    ['All Listings', 'Toutes les annonces'],
    ['View Details', 'Voir les détails'],
    ['See Details', 'Voir les détails'],
    ['Learn More', 'En savoir plus'],
    ['See All', 'Voir tout'],
    ['Show More', 'Afficher plus'],
    ['Show Less', 'Afficher moins'],
    ['Read More', 'Lire la suite'],
    ['Read more', 'Lire la suite'],
    ['Load More', 'Charger plus'],
    ['Go Back', 'Retour'],
    ['Back to', 'Retour à'],
    ['No results found', 'Aucun résultat trouvé'],
    ['No listings found', 'Aucune annonce trouvée'],
    ['Loading...', 'Chargement...'],
    ['Map View', 'Vue carte'],
    ['List View', 'Vue liste'],
    ['Price Range', 'Fourchette de prix'],
    ['Filter by Type', 'Filtrer par type'],
    ['Filter by Price', 'Filtrer par prix'],
    ['Sort: Newest', 'Trier : Plus récent'],
    ['Sort: Price', 'Trier : Prix'],
    ['Sort: Rating', 'Trier : Note'],
    ['Sort by', 'Trier par'],
    ['Sort By', 'Trier par'],
    ['All Types', 'Tous les types'],

    // Sign-in modal
    ['Welcome Back', 'Bon retour'],
    ['Create Account', 'Créer un compte'],
    ['Sign in with Google', 'Se connecter avec Google'],
    ['Continue with Google', 'Continuer avec Google'],
    ['Sign in with Email', 'Se connecter avec email'],
    ['Email address', 'Adresse email'],
    ['Forgot password?', 'Mot de passe oublié ?'],
    ["Don't have an account?", 'Pas encore de compte ?'],
    ['Already have an account?', 'Vous avez déjà un compte ?'],
    ['Verification code', 'Code de vérification'],
    ['Send verification code', 'Envoyer le code de vérification'],
    ['Enter your code', 'Entrez votre code'],
    ['Resend code', 'Renvoyer le code'],

    // Find Roommate page
    ['Find a Roommate', 'Trouver un colocataire'],
    ['Post Your Profile', 'Publier votre profil'],
    ['Looking for a roommate', 'Je cherche un colocataire'],
    ['Pet-friendly', 'Animaux acceptés'],
    ['No pets', "Pas d'animaux"],
    ['Night owl', 'Couche-tard'],
    ['Early bird', 'Lève-tôt'],
    ['Match Found', 'Correspondance trouvée'],
    ['No matches yet', 'Pas encore de correspondances'],
    ['Send Request', 'Envoyer une demande'],

    // Blog
    ['Latest Articles', 'Derniers articles'],
    ['All Articles', 'Tous les articles'],
    ['Related Articles', 'Articles similaires'],
    ['min read', 'min de lecture'],

    // Guide
    ['Student Housing Guide', 'Guide du logement étudiant'],
    ['Renting Tips', 'Conseils pour louer'],
    ["What to Look For", "Ce qu'il faut chercher"],
    ['Important Questions', 'Questions importantes'],
    ['Tenant Rights', 'Droits du locataire'],
    ['Your Rights', 'Vos droits'],

    // Misc
    ['Welcome to RoastMyDorm', 'Bienvenue sur RoastMyDorm'],
    ["Morocco's #1 Student Housing Platform", "La 1ère plateforme de logement étudiant au Maroc"],
    ['Honest reviews from real students', 'Avis honnêtes de vrais étudiants'],
    ['Verified properties', 'Logements vérifiés'],
    ['No hidden fees', 'Pas de frais cachés'],
    ['Contact Support', 'Contacter le support'],

    // Short single-word labels (handled with word boundaries below)
    ['Properties', 'Logements'],
    ['Cities', 'Villes'],
    ['Roommate', 'Colocataire'],
    ['Landlord', 'Propriétaire'],
    ['University', 'Université'],
    ['School', 'École'],
    ['Dormitories', 'Résidences'],
    ['Gender', 'Genre'],
    ['Months', 'Mois'],
    ['Budget', 'Budget'],
    ['Lifestyle', 'Mode de vie'],
    ['Preferences', 'Préférences'],
    ['Non-smoker', 'Non-fumeur'],
    ['Smoker', 'Fumeur'],
    ['Female', 'Femme'],
    ['Male', 'Homme'],
    ['Featured', 'En vedette'],
    ['Popular', 'Populaire'],
    ['Recommended', 'Recommandé'],
    ['Password', 'Mot de passe'],
    ['Cancel', 'Annuler'],
    ['Submit', 'Soumettre'],
    ['Verify', 'Vérifier'],
    ['Decline', 'Refuser'],
    ['Accept', 'Accepter'],
    ['Showing', 'Affichage de'],
    ['results', 'résultats'],
    ['Floors', 'Étages'],
    ['Floor', 'Étage'],
    ['Month', 'Mois'],
    ['Lease', 'Bail'],
    ['Home', 'Accueil'],
    ['About', 'À propos'],
    ['Close', 'Fermer'],
    ['Share', 'Partager'],
    ['Report', 'Signaler'],
    ['Search', 'Rechercher'],
    ['Filter', 'Filtrer'],
    ['Reset', 'Réinitialiser'],
    ['Clear', 'Effacer'],
    ['Next', 'Suivant'],
    ['Previous', 'Précédent'],
    ['Resources', 'Ressources'],
    ['Category', 'Catégorie'],
    ['Published', 'Publié'],
    ['Author', 'Auteur'],
    ['Help', 'Aide'],
    ['Message', 'Message'],
  ];

  // ── Arabic translation pairs (EN → AR) ────────────────────────────────────────
  var T_AR = [
    // Page / meta
    ['Student Housing in Morocco', 'سكن طلابي في المغرب'],
    ['Student Housing near', 'سكن طلابي قرب'],
    ['Find Student Housing', 'ابحث عن سكن طلابي'],
    ['Student Housing', 'سكن طلابي'],
    ['Rentals & Reviews', 'إيجارات وتقييمات'],
    ['Honest Reviews', 'تقييمات صادقة'],
    ['Verified Rentals', 'إيجارات موثقة'],
    ['Near Your University', 'قرب جامعتك'],
    ['near your university', 'قرب جامعتك'],
    ['Browse verified student apartments', 'تصفح شقق طلابية موثقة'],
    ['student apartments, studios and rooms', 'شقق وأستوديوهات وغرف طلابية'],

    // Navigation
    ['How It Works', 'كيف يعمل'],
    ['For Landlords', 'للملاك'],
    ['Find Your Roommate', 'ابحث عن شريك سكن'],
    ['Find Roommate', 'ابحث عن شريك سكن'],
    ['Sign In', 'تسجيل الدخول'],
    ['Sign Up', 'إنشاء حساب'],
    ['Log In', 'تسجيل الدخول'],
    ['Logout', 'تسجيل الخروج'],
    ['Log Out', 'تسجيل الخروج'],
    ['My Account', 'حسابي'],
    ['My Profile', 'ملفي الشخصي'],
    ['Dashboard', 'لوحة التحكم'],

    // Hero
    ['Find Your Room. Find Your Roommate,', 'ابحث عن غرفتك. ابحث عن شريك سكن،'],
    ['Rent with Confidence', 'استأجر بكل ثقة'],
    ['Verified dorms, studios & shared apartments for students across Morocco.', 'سكنات وأستوديوهات وشقق مشتركة موثقة للطلاب في المغرب.'],
    ['Search universities and schools', 'ابحث عن الجامعات والمدارس'],
    ['Search Universities', 'البحث عن الجامعات'],
    ['For Students', 'للطلاب'],
    ['Dormitories', 'مساكن طلابية'],
    ['in Morocco', 'في المغرب'],

    // City cards
    ['verified dorms available - Near', 'سكنات موثقة - قرب'],
    ['verified dorms available  - Near', 'سكنات موثقة - قرب'],
    ['verified dorms available', 'سكنات موثقة متاحة'],
    ['Avg Rent:', 'متوسط الإيجار:'],
    ['Rating:', 'التقييم:'],

    // Browse by University
    ['Campus Housing', 'سكن الحرم الجامعي'],
    ['Browse by University', 'تصفح حسب الجامعة'],
    ['Find verified student housing near your campus — dorms, studios & shared apartments across Morocco.', 'ابحث عن سكن طلابي موثق قرب حرمك الجامعي في المغرب.'],
    ['listings nearby', 'إعلانات قريبة'],
    ['listing nearby', 'إعلان قريب'],
    ['View all universities', 'عرض جميع الجامعات'],
    ['View All Universities', 'عرض جميع الجامعات'],

    // For Students section
    ["Find your perfect student home in Morocco's top cities", 'ابحث عن سكنك الطلابي المثالي في أبرز مدن المغرب'],
    ['City Selection', 'اختيار المدينة'],
    ['Choose from Casablanca, Rabat, and Marrakech', 'اختر بين الدار البيضاء والرباط ومراكش'],
    ['Dorm Listings', 'قوائم السكنات'],
    ['Browse available dorms with photos and details', 'تصفح السكنات المتاحة مع الصور والتفاصيل'],
    ['Payment Options', 'خيارات الدفع'],
    ['Face-to-Face payment arrangements', 'الدفع وجهاً لوجه'],
    ['Direct Contact', 'تواصل مباشر'],
    ['Connect directly with landlords', 'تواصل مباشرة مع الملاك'],

    // How It Works
    ['Browse Listings', 'تصفح الإعلانات'],
    ['Browse listings', 'تصفح الإعلانات'],
    ['Contact Landlord', 'تواصل مع المالك'],
    ['Schedule a Visit', 'حجز موعد للزيارة'],
    ['Find your perfect room', 'ابحث عن غرفتك المثالية'],
    ['Browse through our verified listings', 'تصفح إعلاناتنا الموثقة'],
    ['Reach out to landlords directly', 'تواصل مباشرة مع الملاك'],
    ['Set up a viewing at your convenience', 'رتب زيارة في الوقت المناسب لك'],
    ['Sign your lease and move in', 'وقّع عقدك وانتقل للسكن'],

    // Gallery
    ['View All Photos (', 'عرض الصور ('],
    ['View All Photos', 'عرض جميع الصور'],
    ['All Photos', 'جميع الصور'],

    // Title section
    ['View on Map', 'عرض على الخريطة'],
    ['(1 review)', '(تقييم واحد)'],
    ['No reviews yet. Be the first to share your experience!', 'لا توجد تقييمات بعد. كن أول من يشارك تجربته!'],
    ['No reviews', 'لا توجد تقييمات'],
    [' reviews)', ' تقييمات)'],
    ['reviews)', 'تقييمات)'],
    ['/month', '/شهر'],
    ['per month', 'في الشهر'],
    ['Per month', 'في الشهر'],
    ['Per Month', 'في الشهر'],
    ['utilities included', 'شامل المرافق'],
    ['Utilities Included', 'شامل المرافق'],

    // Specs
    ['Key Specifications', 'المواصفات الرئيسية'],
    ['Key specifications', 'المواصفات الرئيسية'],
    ['Property Details', 'تفاصيل العقار'],
    ['Quick Facts', 'معلومات سريعة'],
    ['Square Footage', 'المساحة'],
    ['square footage', 'المساحة'],
    ['sq ft', 'م²'],
    ['sq m', 'م²'],
    ['Bedrooms', 'غرف النوم'],
    ['Bedroom', 'غرفة نوم'],
    ['Bathrooms', 'الحمامات'],
    ['Bathroom', 'حمام'],
    ['Ensuite', 'حمام خاص'],
    ['ensuite', 'حمام خاص'],
    ['Move-In', 'موعد الانتقال'],
    ['Move-in', 'موعد الانتقال'],
    ['Move In', 'الانتقال'],
    ['Unfurnished', 'غير مفروش'],
    ['Furnished', 'مفروش'],
    ['Available From', 'متاح من'],
    ['Available from', 'متاح من'],
    ['All genders welcome', 'مفتوح للجميع'],
    ['Min. Stay', 'الحد الأدنى للإقامة'],
    ['12 Months', '12 شهراً'],
    ['6 Months', '6 أشهر'],
    ['Lease', 'عقد الإيجار'],

    // Amenities
    ['High-Speed Wi-Fi', 'واي فاي عالي السرعة'],
    ['High Speed Wi-Fi', 'واي فاي عالي السرعة'],
    ['Fitness Center Access', 'صالة رياضية'],
    ['Fitness Center', 'مركز لياقة بدنية'],
    ['In-unit Laundry', 'غسالة داخل الوحدة'],
    ['In-Unit Laundry', 'غسالة داخل الوحدة'],
    ['24/7 Security', 'أمن على مدار الساعة'],
    ['Air Conditioning', 'تكييف هواء'],
    ['Parking Available', 'موقف سيارات'],
    ['Smart TV Included', 'تلفزيون ذكي مشمول'],
    ['Smart TV', 'تلفزيون ذكي'],
    ['Fully Equipped Kitchen', 'مطبخ مجهز بالكامل'],
    ['Equipped Kitchen', 'مطبخ مجهز'],
    ['Rooftop Access', 'وصول للسطح'],
    ['Swimming Pool', 'مسبح'],
    ['Garden Access', 'وصول للحديقة'],
    ['Study Room', 'غرفة دراسة'],
    ['Common Area', 'منطقة مشتركة'],
    ['Water Heater', 'سخان مياه'],
    ['Washing Machine', 'غسالة ملابس'],
    ['Dishwasher', 'غسالة أطباق'],
    ['Refrigerator', 'ثلاجة'],
    ['Microwave', 'ميكروويف'],
    ['Elevator', 'مصعد'],
    ['Balcony', 'شرفة'],
    ['Terrace', 'تراس'],
    ['Heating', 'تدفئة'],
    ['Dryer', 'مجفف ملابس'],
    ["What's Included", 'ما هو مشمول'],
    ['Amenities', 'المرافق والخدمات'],

    // Description
    ['About This Space', 'عن هذا المكان'],
    ['About This Property', 'عن هذا العقار'],
    ['About this space', 'عن هذا المكان'],
    ['About this property', 'عن هذا العقار'],
    ['View Full Map', 'عرض الخريطة الكاملة'],
    ['min walk to', 'دقيقة سيراً إلى'],
    ['min walk', 'دقيقة سيراً'],
    ['minutes walk', 'دقائق سيراً'],
    ['minute walk', 'دقيقة سيراً'],
    ['Walkability:', 'قابلية المشي:'],
    ['Nearby amenities', 'مرافق قريبة'],
    ['nearby amenities', 'مرافق قريبة'],

    // Reviews
    ['Student Reviews', 'تقييمات الطلاب'],
    ['Student reviews', 'تقييمات الطلاب'],
    ['No reviews yet. Be the first to share your experience!', 'لا توجد تقييمات بعد. كن أول من يشارك تجربته!'],
    ['Write a Review', 'كتابة تقييم'],
    ['Leave a Review', 'كتابة تقييم'],
    ['Submit Review', 'إرسال التقييم'],
    ['Your Review', 'تقييمك'],
    ['Overall Rating', 'التقييم العام'],
    ['Location Rating', 'تقييم الموقع'],
    ['Value Rating', 'تقييم القيمة مقابل السعر'],
    ['Cleanliness', 'النظافة'],
    ['Read all reviews', 'قراءة جميع التقييمات'],
    ['See all reviews', 'عرض جميع التقييمات'],

    // Booking widget
    ['Verified Listing', 'إعلان موثق'],
    ['Verified listing', 'إعلان موثق'],
    ['Enquire Now', 'تواصل الآن'],
    ['Contact Now', 'تواصل الآن'],
    ['Book Now', 'احجز الآن'],
    ['Request Info', 'طلب معلومات'],
    ['Verified property', 'عقار موثق'],
    ['Verified Property', 'عقار موثق'],
    ['Direct landlord contact', 'تواصل مباشر مع المالك'],
    ['No agency fees', 'بدون رسوم وكالة'],
    ['No Agency Fees', 'بدون رسوم وكالة'],
    ['Available Now', 'متاح الآن'],
    ['Contact via WhatsApp', 'تواصل عبر واتساب'],
    ['Contact Landlord', 'تواصل مع المالك'],

    // Enquiry modal
    ['Your Full Name *', 'اسمك الكامل *'],
    ['Your Full Name', 'اسمك الكامل'],
    ['Full Name', 'الاسم الكامل'],
    ['Your Email *', 'بريدك الإلكتروني *'],
    ['Your Email', 'بريدك الإلكتروني'],
    ['Your Phone Number (WhatsApp) *', 'رقم واتساب *'],
    ['Your Phone Number (WhatsApp)', 'رقم واتساب'],
    ['Your Phone Number', 'رقم هاتفك'],
    ['Your Message', 'رسالتك'],
    ['i.e. Hello, I am a student', 'مثال: مرحباً، أنا طالب'],
    ['Send Enquiry', 'إرسال الطلب'],
    ['Send enquiry', 'إرسال الطلب'],
    ['Send Message', 'إرسال الرسالة'],

    // Footer
    ['All rights reserved', 'جميع الحقوق محفوظة'],
    ['Privacy Policy', 'سياسة الخصوصية'],
    ['Terms & Conditions', 'الشروط والأحكام'],
    ['Terms of Service', 'شروط الخدمة'],
    ['Contact Us', 'تواصل معنا'],
    ['About Us', 'معلومات عنا'],
    ['Quick Links', 'روابط سريعة'],
    ['Follow Us', 'تابعنا'],
    ['Get the latest listings', 'احصل على أحدث الإعلانات'],
    ['Subscribe', 'اشترك'],

    // Common property labels
    ['Not Available', 'غير متاح'],
    ['Available', 'متاح'],
    ['Shared Apartment', 'شقة مشتركة'],
    ['Shared Room', 'غرفة مشتركة'],
    ['Shared Studio', 'أستوديو مشترك'],
    ['Near University', 'قرب الجامعة'],
    ['Near university', 'قرب الجامعة'],
    ['Nearby Universities', 'جامعات قريبة'],
    ['Apartment', 'شقة'],

    // UI actions
    ['Browse All Listings', 'عرض جميع الإعلانات'],
    ['All Listings', 'جميع الإعلانات'],
    ['View Details', 'عرض التفاصيل'],
    ['See Details', 'عرض التفاصيل'],
    ['Learn More', 'اعرف أكثر'],
    ['See All', 'عرض الكل'],
    ['Show More', 'عرض المزيد'],
    ['Show Less', 'عرض أقل'],
    ['Read More', 'اقرأ أكثر'],
    ['Read more', 'اقرأ أكثر'],
    ['Load More', 'تحميل المزيد'],
    ['Go Back', 'رجوع'],
    ['Back to', 'العودة إلى'],
    ['No results found', 'لا توجد نتائج'],
    ['No listings found', 'لا توجد إعلانات'],
    ['Loading...', 'جار التحميل...'],
    ['Map View', 'عرض الخريطة'],
    ['List View', 'عرض القائمة'],
    ['Price Range', 'نطاق السعر'],
    ['Filter by Type', 'تصفية حسب النوع'],
    ['Filter by Price', 'تصفية حسب السعر'],
    ['Sort by', 'ترتيب حسب'],
    ['Sort By', 'ترتيب حسب'],
    ['All Types', 'جميع الأنواع'],

    // Auth
    ['Welcome Back', 'مرحباً بعودتك'],
    ['Welcome to RoastMyDorm', 'مرحباً بك في RoastMyDorm'],
    ['Create Account', 'إنشاء حساب'],
    ['Sign in with Google', 'تسجيل الدخول بـ Google'],
    ['Continue with Google', 'المتابعة بـ Google'],
    ['Sign in with Email', 'تسجيل الدخول بالبريد الإلكتروني'],
    ['Email address', 'البريد الإلكتروني'],
    ['Forgot password?', 'نسيت كلمة المرور؟'],
    ["Don't have an account?", 'ليس لديك حساب؟'],
    ['Already have an account?', 'لديك حساب بالفعل؟'],
    ['Verification code', 'رمز التحقق'],
    ['Send verification code', 'إرسال رمز التحقق'],
    ['Enter your code', 'أدخل الرمز'],
    ['Resend code', 'إعادة إرسال الرمز'],

    // Find Roommate
    ['Find a Roommate', 'ابحث عن شريك سكن'],
    ['Post Your Profile', 'انشر ملفك الشخصي'],
    ['Pet-friendly', 'يقبل الحيوانات الأليفة'],
    ['No pets', 'لا حيوانات أليفة'],
    ['Night owl', 'سهران ليلاً'],
    ['Early bird', 'يستيقظ مبكراً'],
    ['Send Request', 'إرسال طلب'],

    // Short labels
    ['Properties', 'عقارات'],
    ['Cities', 'مدن'],
    ['Roommate', 'شريك سكن'],
    ['Landlord', 'المالك'],
    ['University', 'جامعة'],
    ['School', 'مدرسة'],
    ['Months', 'أشهر'],
    ['Budget', 'الميزانية'],
    ['Lifestyle', 'نمط الحياة'],
    ['Preferences', 'التفضيلات'],
    ['Non-smoker', 'غير مدخن'],
    ['Smoker', 'مدخن'],
    ['Female', 'أنثى'],
    ['Male', 'ذكر'],
    ['Featured', 'مميز'],
    ['Popular', 'شائع'],
    ['Recommended', 'موصى به'],
    ['Password', 'كلمة المرور'],
    ['Cancel', 'إلغاء'],
    ['Submit', 'إرسال'],
    ['Verify', 'تحقق'],
    ['Decline', 'رفض'],
    ['Accept', 'قبول'],
    ['Showing', 'عرض'],
    ['results', 'نتائج'],
    ['Floor', 'الطابق'],
    ['Month', 'شهر'],
    ['Home', 'الرئيسية'],
    ['About', 'حول'],
    ['Close', 'إغلاق'],
    ['Share', 'مشاركة'],
    ['Report', 'إبلاغ'],
    ['Search', 'بحث'],
    ['Filter', 'تصفية'],
    ['Reset', 'إعادة تعيين'],
    ['Clear', 'مسح'],
    ['Next', 'التالي'],
    ['Previous', 'السابق'],
    ['Help', 'مساعدة'],
    ['Message', 'رسالة'],
  ];

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function escRx(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Use word boundaries for single-word phrases to avoid partial matches
  // e.g. 'Home' won't match 'Homepage', 'Month' won't match 'Monthly'
  function applyPair(text, en, fr) {
    if (text.indexOf(en) === -1) return text;
    if (/\s/.test(en) || !/^[\w'-]+$/.test(en)) {
      // Multi-word or contains special chars — simple global replace
      return text.split(en).join(fr);
    }
    // Single word — use word boundaries
    return text.replace(new RegExp('\\b' + escRx(en) + '\\b', 'g'), fr);
  }

  function translateAttr(el, attr, pairs) {
    var val = el.getAttribute(attr);
    if (!val) return;
    var updated = val;
    for (var i = 0; i < pairs.length; i++) {
      updated = applyPair(updated, pairs[i][0], pairs[i][1]);
    }
    if (updated !== val) el.setAttribute(attr, updated);
  }

  function applyTranslations(pairs, langCode) {
    // Walk all text nodes (skip SCRIPT and STYLE)
    var walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          var tag = node.parentElement && node.parentElement.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );

    var nodes = [];
    var n;
    while ((n = walker.nextNode())) nodes.push(n);

    for (var i = 0; i < nodes.length; i++) {
      var nd = nodes[i];
      var text = nd.nodeValue;
      if (!text || !text.trim()) continue;
      var updated = text;
      for (var j = 0; j < pairs.length; j++) {
        updated = applyPair(updated, pairs[j][0], pairs[j][1]);
      }
      if (updated !== text) nd.nodeValue = updated;
    }

    // Translate placeholder, alt, title attributes
    document.querySelectorAll('[placeholder],[alt],[title]').forEach(function (el) {
      ['placeholder', 'alt', 'title'].forEach(function (attr) {
        if (el.hasAttribute(attr)) translateAttr(el, attr, pairs);
      });
    });

    document.documentElement.lang = langCode;
    if (langCode === 'ar') {
      document.documentElement.dir = 'rtl';
    }
  }

  // ── Language state ────────────────────────────────────────────────────────────

  function getLang() {
    return localStorage.getItem('rmd_lang') || 'en';
  }

  function setLang(lang) {
    localStorage.setItem('rmd_lang', lang);
    window.location.reload();
  }

  // ── Dropdown toggle ───────────────────────────────────────────────────────────

  var LANGS = [
    { code: 'en', flag: '&#127468;&#127463;', label: 'EN', full: 'English' },
    { code: 'fr', flag: '&#127467;&#127479;', label: 'FR', full: 'Français' },
    { code: 'ar', flag: '&#127474;&#127462;', label: 'عربي', full: 'العربية' }
  ];

  // Hide the language toggle on mobile only — desktop keeps it via the
  // default inline-flex set in createToggle().
  function injectMobileHideStyle() {
    if (document.getElementById('rmd-lang-mobile-hide')) return;
    var style = document.createElement('style');
    style.id = 'rmd-lang-mobile-hide';
    style.textContent = '@media (max-width: 767px) { #rmd-lang-wrapper { display: none !important; } }';
    document.head.appendChild(style);
  }

  function createToggle(currentLang) {
    var cur = LANGS.filter(function(l) { return l.code === currentLang; })[0] || LANGS[0];

    injectMobileHideStyle();

    // Wrapper (needed for absolute dropdown positioning)
    var wrapper = document.createElement('div');
    wrapper.id = 'rmd-lang-wrapper';
    wrapper.style.cssText = 'position:relative;display:inline-flex;align-items:center;flex-shrink:0;';

    // Main button
    var btn = document.createElement('button');
    btn.id = 'rmd-lang-toggle';
    btn.innerHTML = '<span style="font-size:15px;line-height:1">' + cur.flag + '</span>&nbsp;' + cur.label + '&nbsp;<span style="font-size:10px;opacity:0.8">▾</span>';
    btn.title = 'Change language';
    btn.style.cssText = 'background:#10b981;color:#fff;border:none;border-radius:7px;padding:8px 13px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:4px;font-family:inherit;letter-spacing:0.4px;transition:background 0.2s,transform 0.15s;flex-shrink:0;';
    btn.onmouseenter = function() { btn.style.background = '#059669'; btn.style.transform = 'translateY(-1px)'; };
    btn.onmouseleave = function() { btn.style.background = '#10b981'; btn.style.transform = ''; };

    // Dropdown menu
    var menu = document.createElement('div');
    menu.id = 'rmd-lang-menu';
    menu.style.cssText = 'display:none;position:absolute;top:calc(100% + 8px);right:0;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.13);overflow:hidden;min-width:148px;z-index:100000;';

    LANGS.forEach(function(lang) {
      var opt = document.createElement('button');
      var isActive = lang.code === currentLang;
      opt.innerHTML = '<span style="font-size:16px">' + lang.flag + '</span>' + lang.full;
      opt.style.cssText = 'width:100%;padding:10px 16px;border:none;background:' + (isActive ? '#f0fdf4' : '#fff') + ';color:' + (isActive ? '#059669' : '#374151') + ';font-weight:' + (isActive ? '700' : '500') + ';font-size:14px;cursor:' + (isActive ? 'default' : 'pointer') + ';text-align:left;display:flex;align-items:center;gap:10px;font-family:inherit;transition:background 0.15s;border-bottom:1px solid #f3f4f6;';
      if (!isActive) {
        opt.onmouseenter = function() { opt.style.background = '#f9fafb'; };
        opt.onmouseleave = function() { opt.style.background = '#fff'; };
        opt.onclick = function(e) { e.stopPropagation(); setLang(lang.code); };
      }
      menu.appendChild(opt);
    });

    // Remove border-bottom from last option
    if (menu.lastChild) menu.lastChild.style.borderBottom = 'none';

    // Toggle open/close
    var menuOpen = false;
    btn.onclick = function(e) {
      e.stopPropagation();
      menuOpen = !menuOpen;
      menu.style.display = menuOpen ? 'block' : 'none';
    };
    document.addEventListener('click', function() {
      if (menuOpen) { menu.style.display = 'none'; menuOpen = false; }
    });

    wrapper.appendChild(btn);
    wrapper.appendChild(menu);

    // Inject into navbar or fall back to fixed floating
    var navTarget =
      document.querySelector('.nav-menu') ||
      document.querySelector('.header-container') ||
      document.querySelector('.header-content') ||
      document.querySelector('.nav-links') ||
      document.querySelector('.navbar-links') ||
      document.querySelector('.nav-content');

    if (navTarget) {
      navTarget.appendChild(wrapper);
    } else {
      // Floating fallback
      wrapper.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99999;';
      btn.style.boxShadow = '0 4px 16px rgba(16,185,129,0.45)';
      btn.style.borderRadius = '50px';
      btn.style.padding = '10px 18px';
      document.body.appendChild(wrapper);
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  function init() {
    var lang = getLang();
    if (lang === 'fr') applyTranslations(T, 'fr');
    if (lang === 'ar') applyTranslations(T_AR, 'ar');
    createToggle(lang);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
