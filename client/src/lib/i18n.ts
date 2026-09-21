/**
 * DX Daruma — Système d'internationalisation (i18n)
 * Langues supportées : FR, EN, DE, PL, ES, IT
 */

export type Locale = "fr" | "en" | "de" | "pl" | "es" | "it";

export interface LocaleInfo {
  code: Locale;
  label: string;
  flag: string; // emoji flag
}

export const LOCALES: LocaleInfo[] = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "pl", label: "Polski", flag: "🇵🇱" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
];

// ─── Traductions ──────────────────────────────────────────────────────────────

type TranslationKeys = {
  // Header
  appName: string;
  appSubtitle: string;
  utc: string;
  refresh: string;
  total: string;
  rare: string;

  // Filters
  filters: string;
  bands: string;
  bandsHf: string;
  bandsVhf: string;
  modes: string;
  continents: string;
  rareOnly: string;
  search: string;
  searchPlaceholder: string;
  sound: string;
  sporadicAlert: string;
  prioritizeSsb: string;
  onlyNewDxcc: string;

  // Propagation alerts
  propagationAlert: string;
  sporadicE: string;
  tep: string;
  tropo: string;
  meteorScatter: string;
  aurora: string;
  f2Layer: string;
  backscatter: string;
  unknownProp: string;
  openingSince: string;
  stations: string;
  direction: string;
  maxDistance: string;
  confidence: string;
  high: string;
  medium: string;
  low: string;
  noOpenings: string;
  vhfActivity: string;

  // Spot detail
  spotDetail: string;
  frequency: string;
  mode: string;
  country: string;
  continent: string;
  spotter: string;
  comment: string;
  time: string;
  listenOn: string;

  // Multipliers
  multipliers: string;
  workedBands: string;
  notHeard: string;
  heardOn: string;
  department: string;
  noSpotsYet: string;

  // Connection
  connected: string;
  connecting: string;
  disconnected: string;

  // WhatsApp
  whatsappContact: string;
  whatsappMessage: string;

  // Landing page
  heroTitle: string;
  heroSubtitle: string;
  enterApp: string;
  login: string;
  signupFree: string;
  documentation: string;
  featuresTitle: string;
  featureCluster: string;
  featureClusterDesc: string;
  featureMonitor: string;
  featureMonitorDesc: string;
  featureMultipliers: string;
  featureMultipliersDesc: string;
  featurePropagation: string;
  featurePropagationDesc: string;
  featureWintest: string;
  featureWintestDesc: string;
  featureMultilang: string;
  featureMultilangDesc: string;
  pricingTitle: string;
  pricingSubtitle: string;
  planFree: string;
  planPremium: string;
  year: string;
  planFreeF1: string;
  planFreeF2: string;
  planFreeF3: string;
  planPremF1: string;
  planPremF2: string;
  planPremF3: string;
  planPremF4: string;
  planPremF5: string;
  planPremF6: string;
  upgradePremium: string;
  paypalNote: string;
  premiumRequired: string;

  // Locator
  locatorTitle: string;
  locatorDesc: string;
  invalidLocator: string;
  errorSaving: string;
  save: string;

  // Dashboard sections
  pilot: string;
  forecast7d: string;
  plan24h: string;
  dxMap: string;
  bandActivity: string;
  continentOpenings: string;
  ft8Propagation: string;
  resetFilters: string;
  noSpotMatch: string;
  online: string;

  // Self-Monitor
  selfMonitor: string;
  selfMonitorDesc: string;
  freqKhz: string;
  bearing: string;
  pathSP: string;
  pathLP: string;
  local: string;
  distant: string;
  islands: string;
  searchSdr: string;
  noSdrFound: string;
  listenSdr: string;
  favorite: string;
  deleteSdr: string;

  // Profile page
  profileTitle: string;
  profileInfo: string;
  profileName: string;
  profileEmail: string;
  profileMemberSince: string;
  profileSubscription: string;
  profilePremium: string;
  profileFree: string;
  profileExpiresOn: string;
  profileUpgradeMsg: string;
  profileViewPricing: string;
  profileLocatorTitle: string;
  profileLocatorDesc: string;
  profileLocatorCurrent: string;
  profileSave: string;
  profileBack: string;
  profileLoginRequired: string;
  profileLoginMsg: string;
  profileLoginBtn: string;

  // Spot distance
  distance: string;
  azimuth: string;

  // Locator prompt modal
  locatorPromptTitle: string;
  locatorPromptSubtitle: string;
  locatorPromptPlaceholder: string;
  locatorPromptHelp: string;
  locatorPromptSave: string;
  locatorPromptSkip: string;
  locatorPromptInvalid: string;
  // General
  close: string;
  loading: string;
  error: string;
  ago: string;
  min: string;
  sec: string;
};

const fr: TranslationKeys = {
  appName: "DX Daruma",
  appSubtitle: "Le radar DX du shack · SSB prioritaire",
  utc: "UTC",
  refresh: "Actualiser",
  total: "Total",
  rare: "Rares",

  filters: "Filtres",
  bands: "Bandes",
  bandsHf: "HF",
  bandsVhf: "VHF/UHF",
  modes: "Modes",
  continents: "Continents",
  rareOnly: "Rares uniquement",
  search: "Recherche",
  searchPlaceholder: "Indicatif, pays, mode...",
  sound: "Son",
  sporadicAlert: "Alerte sporadique",
  prioritizeSsb: "Priorité SSB",
  onlyNewDxcc: "DXCC non travaillés",

  propagationAlert: "ALERTE PROPAGATION",
  sporadicE: "Sporadique E",
  tep: "TEP",
  tropo: "Tropo",
  meteorScatter: "Meteor Scatter",
  aurora: "Aurora",
  f2Layer: "Couche F2",
  backscatter: "Backscatter",
  unknownProp: "Inconnu",
  openingSince: "Ouverture depuis",
  stations: "Stations",
  direction: "Direction",
  maxDistance: "Distance max",
  confidence: "Confiance",
  high: "Haute",
  medium: "Moyenne",
  low: "Faible",
  noOpenings: "Aucune ouverture détectée",
  vhfActivity: "Activité VHF",

  spotDetail: "Détail du spot",
  frequency: "Fréquence",
  mode: "Mode",
  country: "Pays",
  continent: "Continent",
  spotter: "Spotteur",
  comment: "Commentaire",
  time: "Heure",
  listenOn: "Écouter sur",

  multipliers: "Multiplicateurs",
  workedBands: "Bandes travaillées",
  notHeard: "Pas encore entendu",
  heardOn: "Entendu sur",
  department: "Département",
  noSpotsYet: "Aucun spot pour ce multiplicateur",

  connected: "Connecté",
  connecting: "Connexion...",
  disconnected: "Déconnecté",

  whatsappContact: "Contacter via WhatsApp",
  whatsappMessage: "Bonjour, j'ai une question sur DX Daruma...",

  heroTitle: "Votre radar DX en temps réel",
  heroSubtitle: "Spots DX multi-sources, alertes sporadiques, Self-Monitor WebSDR, suivi multiplicateurs — tout pour le contest et le DX.",
  enterApp: "Accéder à l'application",
  login: "Se connecter",
  signupFree: "S'inscrire gratuitement",
  documentation: "Documentation",
  featuresTitle: "Fonctionnalités",
  featureCluster: "DX Cluster multi-sources",
  featureClusterDesc: "Spots en temps réel depuis Spothole, DX Summit et PSK Reporter, fusionnés et dédupliqués.",
  featureMonitor: "Self-Monitor WebSDR",
  featureMonitorDesc: "Écoutez votre signal sur des récepteurs distants pour vérifier votre qualité audio.",
  featureMultipliers: "Suivi multiplicateurs",
  featureMultipliersDesc: "Grille complète des multiplicateurs par concours (WPX, WW, IARU, REF) avec alertes.",
  featurePropagation: "Alertes propagation",
  featurePropagationDesc: "Détection automatique des ouvertures sporadiques (Es, TEP, Tropo, MS, Aurora).",
  featureWintest: "Intégration Win-Test",
  featureWintestDesc: "Flux DX Cluster compatible Win-Test/DXLog via WebSocket relay.",
  featureMultilang: "Multilingue",
  featureMultilangDesc: "Interface disponible en français, anglais, allemand, polonais, espagnol et italien.",
  pricingTitle: "Tarifs",
  pricingSubtitle: "Accès gratuit au cluster. Débloquez toutes les fonctionnalités avec Premium.",
  planFree: "Gratuit",
  planPremium: "Premium",
  year: "an",
  planFreeF1: "Flux DX Cluster en temps réel",
  planFreeF2: "Filtres par bande et mode",
  planFreeF3: "Interface multilingue",
  planPremF1: "Tout le plan Gratuit",
  planPremF2: "Self-Monitor WebSDR",
  planPremF3: "Suivi multiplicateurs complet",
  planPremF4: "Alertes propagation sporadique",
  planPremF5: "Intégration Win-Test/DXLog",
  planPremF6: "Mises à jour gratuites à vie",
  upgradePremium: "Passer Premium (50$/an)",
  paypalNote: "Paiement via PayPal. Accès activé manuellement sous 24h.",
  premiumRequired: "Fonctionnalité Premium requise",

  locatorTitle: "Votre QTH Locator",
  locatorDesc: "Entrez votre locator Maidenhead pour personnaliser les calculs de distance et d'azimut.",
  invalidLocator: "Locator invalide (ex: JN18du)",
  errorSaving: "Erreur lors de la sauvegarde",
  save: "Enregistrer",

  pilot: "Pilotage",
  forecast7d: "Prévisions 7j",
  plan24h: "Plan 24h",
  dxMap: "Carte DX",
  bandActivity: "Activité par bande",
  continentOpenings: "Ouverture par continent",
  ft8Propagation: "Propagation FT8 (temps réel)",
  resetFilters: "Reset",
  noSpotMatch: "Aucun spot ne correspond aux filtres.",
  online: "En ligne",

  selfMonitor: "Self-Monitor",
  selfMonitorDesc: "Écoute WebSDR intelligente",
  freqKhz: "Fréq. (kHz)",
  bearing: "Azimut",
  pathSP: "Short Path",
  pathLP: "Long Path",
  local: "Local",
  distant: "Lointain",
  islands: "Îles",
  searchSdr: "Rechercher",
  noSdrFound: "Aucun SDR trouvé",
  listenSdr: "Écouter",
  favorite: "Favori",
  deleteSdr: "Supprimer",

  close: "Fermer",
  loading: "Chargement...",
  // Profile
  profileTitle: "Mon Profil",
  profileInfo: "Informations",
  profileName: "Nom",
  profileEmail: "Email",
  profileMemberSince: "Membre depuis",
  profileSubscription: "Abonnement",
  profilePremium: "Premium",
  profileFree: "Gratuit",
  profileExpiresOn: "Expire le",
  profileUpgradeMsg: "Passez à Premium pour accéder au Self-Monitor, Pilotage, Multiplicateurs, Prévisions et alertes sporadiques.",
  profileViewPricing: "Voir les tarifs",
  profileLocatorTitle: "QTH Locator",
  profileLocatorDesc: "Votre locator Maidenhead est utilisé pour calculer les distances, azimuts et recommandations de propagation personnalisées.",
  profileLocatorCurrent: "Locator actuel",
  profileSave: "Sauvegarder",
  profileBack: "Retour au Radar",
  profileLoginRequired: "Connexion requise",
  profileLoginMsg: "Connectez-vous pour accéder à votre profil.",
  profileLoginBtn: "Se connecter",
    // Locator prompt modal
  locatorPromptTitle: "Bienvenue sur DX Daruma !",
  locatorPromptSubtitle: "Pour personnaliser les calculs de propagation, distances et azimuts, veuillez entrer votre locator Maidenhead.",
  locatorPromptPlaceholder: "Ex: JN18du",
  locatorPromptHelp: "Votre locator (4 ou 6 caractères) se trouve sur QRZ.com ou via votre GPS. Il permet de calculer les distances et azimuts vers les stations DX.",
  locatorPromptSave: "Enregistrer mon locator",
  locatorPromptSkip: "Plus tard",
  locatorPromptInvalid: "Format invalide. Exemple : JN18du (4 ou 6 caractères).",
  // Spot distance
  distance: "Dist.",
  azimuth: "Az.",
  // General
  error: "Erreur",
  ago: "il y a",
  min: "min",
  sec: "s",
};
const en: TranslationKeys = {
  appName: "DX Daruma",
  appSubtitle: "The shack DX radar · SSB priority",
  utc: "UTC",
  refresh: "Refresh",
  total: "Total",
  rare: "Rare",

  filters: "Filters",
  bands: "Bands",
  bandsHf: "HF",
  bandsVhf: "VHF/UHF",
  modes: "Modes",
  continents: "Continents",
  rareOnly: "Rare only",
  search: "Search",
  searchPlaceholder: "Callsign, country, mode...",
  sound: "Sound",
  sporadicAlert: "Sporadic alert",
  prioritizeSsb: "SSB priority",

  propagationAlert: "PROPAGATION ALERT",
  onlyNewDxcc: "Unworked DXCC only",
  sporadicE: "Sporadic E",
  tep: "TEP",
  tropo: "Tropo",
  meteorScatter: "Meteor Scatter",
  aurora: "Aurora",
  f2Layer: "F2 Layer",
  backscatter: "Backscatter",
  unknownProp: "Unknown",
  openingSince: "Opening since",
  stations: "Stations",
  direction: "Direction",
  maxDistance: "Max distance",
  confidence: "Confidence",
  high: "High",
  medium: "Medium",
  low: "Low",
  noOpenings: "No openings detected",
  vhfActivity: "VHF Activity",

  spotDetail: "Spot detail",
  frequency: "Frequency",
  mode: "Mode",
  country: "Country",
  continent: "Continent",
  spotter: "Spotter",
  comment: "Comment",
  time: "Time",
  listenOn: "Listen on",

  multipliers: "Multipliers",
  workedBands: "Worked bands",
  notHeard: "Not heard yet",
  heardOn: "Heard on",
  department: "Department",
  noSpotsYet: "No spots for this multiplier",

  connected: "Connected",
  connecting: "Connecting...",
  disconnected: "Disconnected",

  whatsappContact: "Contact via WhatsApp",
  whatsappMessage: "Hello, I have a question about DX Daruma...",

  heroTitle: "Your real-time DX radar",
  heroSubtitle: "Multi-source DX spots, sporadic alerts, WebSDR Self-Monitor, multiplier tracking — everything for contest and DX.",
  enterApp: "Enter application",
  login: "Log in",
  signupFree: "Sign up free",
  documentation: "Documentation",
  featuresTitle: "Features",
  featureCluster: "Multi-source DX Cluster",
  featureClusterDesc: "Real-time spots from Spothole, DX Summit and PSK Reporter, merged and deduplicated.",
  featureMonitor: "WebSDR Self-Monitor",
  featureMonitorDesc: "Listen to your signal on remote receivers to check your audio quality.",
  featureMultipliers: "Multiplier tracking",
  featureMultipliersDesc: "Complete multiplier grid per contest (WPX, WW, IARU, REF) with alerts.",
  featurePropagation: "Propagation alerts",
  featurePropagationDesc: "Automatic detection of sporadic openings (Es, TEP, Tropo, MS, Aurora).",
  featureWintest: "Win-Test integration",
  featureWintestDesc: "DX Cluster feed compatible with Win-Test/DXLog via WebSocket relay.",
  featureMultilang: "Multilingual",
  featureMultilangDesc: "Interface available in French, English, German, Polish, Spanish and Italian.",
  pricingTitle: "Pricing",
  pricingSubtitle: "Free access to the cluster. Unlock all features with Premium.",
  planFree: "Free",
  planPremium: "Premium",
  year: "year",
  planFreeF1: "Real-time DX Cluster feed",
  planFreeF2: "Band and mode filters",
  planFreeF3: "Multilingual interface",
  planPremF1: "Everything in Free",
  planPremF2: "WebSDR Self-Monitor",
  planPremF3: "Full multiplier tracking",
  planPremF4: "Sporadic propagation alerts",
  planPremF5: "Win-Test/DXLog integration",
  planPremF6: "Free lifetime updates",
  upgradePremium: "Upgrade Premium ($50/year)",
  paypalNote: "Payment via PayPal. Access activated manually within 24h.",
  premiumRequired: "Premium feature required",

  locatorTitle: "Your QTH Locator",
  locatorDesc: "Enter your Maidenhead locator to customize distance and azimuth calculations.",
  invalidLocator: "Invalid locator (e.g. JN18du)",
  errorSaving: "Error saving",
  save: "Save",

  pilot: "Pilot",
  forecast7d: "7-day Forecast",
  plan24h: "24h Plan",
  dxMap: "DX Map",
  bandActivity: "Band activity",
  continentOpenings: "Continent openings",
  ft8Propagation: "FT8 Propagation (real-time)",
  resetFilters: "Reset",
  noSpotMatch: "No spots match the filters.",
  online: "Online",

  selfMonitor: "Self-Monitor",
  selfMonitorDesc: "Smart WebSDR listening",
  freqKhz: "Freq. (kHz)",
  bearing: "Bearing",
  pathSP: "Short Path",
  pathLP: "Long Path",
  local: "Local",
  distant: "Distant",
  islands: "Islands",
  searchSdr: "Search",
  noSdrFound: "No SDR found",
  listenSdr: "Listen",
  favorite: "Favorite",
  deleteSdr: "Delete",

  close: "Close",
  loading: "Loading...",
    // Profile
  profileTitle: "My Profile",
  profileInfo: "Information",
  profileName: "Name",
  profileEmail: "Email",
  profileMemberSince: "Member since",
  profileSubscription: "Subscription",
  profilePremium: "Premium",
  profileFree: "Free",
  profileExpiresOn: "Expires on",
  profileUpgradeMsg: "Upgrade to Premium to access Self-Monitor, Piloting, Multipliers, Forecasts and sporadic alerts.",
  profileViewPricing: "View pricing",
  profileLocatorTitle: "QTH Locator",
  profileLocatorDesc: "Your Maidenhead locator is used to calculate personalized distances, azimuths and propagation recommendations.",
  profileLocatorCurrent: "Current locator",
  profileSave: "Save",
  profileBack: "Back to Radar",
  profileLoginRequired: "Login required",
  profileLoginMsg: "Log in to access your profile.",
  profileLoginBtn: "Log in",
  // Locator prompt modal
  locatorPromptTitle: "Welcome to DX Daruma!",
  locatorPromptSubtitle: "To customize propagation calculations, distances and bearings, please enter your Maidenhead locator.",
  locatorPromptPlaceholder: "E.g. JN18du",
  locatorPromptHelp: "Your locator (4 or 6 characters) can be found on QRZ.com or via your GPS. It is used to calculate distances and bearings to DX stations.",
  locatorPromptSave: "Save my locator",
  locatorPromptSkip: "Later",
  locatorPromptInvalid: "Invalid format. Example: JN18du (4 or 6 characters).",
  // Spot distance
  distance: "Dist.",
  azimuth: "Az.",
  // General
  error: "Error",
  ago: "ago",
  min: "min",
  sec: "s",
};
const de: TranslationKeys = {
  appName: "DX Daruma",
  appSubtitle: "Das DX-Radar der Funkstation · SSB-Priorität",
  utc: "UTC",
  refresh: "Aktualisieren",
  total: "Gesamt",
  rare: "Selten",

  filters: "Filter",
  bands: "Bänder",
  bandsHf: "KW",
  bandsVhf: "VHF/UHF",
  modes: "Modi",
  continents: "Kontinente",
  rareOnly: "Nur seltene",
  search: "Suche",
  searchPlaceholder: "Rufzeichen, Land, Modus...",
  sound: "Ton",
  sporadicAlert: "Sporadisch-Alarm",
  prioritizeSsb: "SSB-Priorität",
  onlyNewDxcc: "Nur neue DXCC",

  propagationAlert: "AUSBREITUNGSALARM",
  sporadicE: "Sporadisch E",
  tep: "TEP",
  tropo: "Tropo",
  meteorScatter: "Meteorscatter",
  aurora: "Aurora",
  f2Layer: "F2-Schicht",
  backscatter: "Backscatter",
  unknownProp: "Unbekannt",
  openingSince: "Öffnung seit",
  stations: "Stationen",
  direction: "Richtung",
  maxDistance: "Max. Entfernung",
  confidence: "Vertrauen",
  high: "Hoch",
  medium: "Mittel",
  low: "Niedrig",
  noOpenings: "Keine Öffnungen erkannt",
  vhfActivity: "VHF-Aktivität",

  spotDetail: "Spot-Detail",
  frequency: "Frequenz",
  mode: "Modus",
  country: "Land",
  continent: "Kontinent",
  spotter: "Spotter",
  comment: "Kommentar",
  time: "Zeit",
  listenOn: "Hören auf",

  multipliers: "Multiplikatoren",
  workedBands: "Gearbeitete Bänder",
  notHeard: "Noch nicht gehört",
  heardOn: "Gehört auf",
  department: "Département",
  noSpotsYet: "Keine Spots für diesen Multiplikator",

  connected: "Verbunden",
  connecting: "Verbindung...",
  disconnected: "Getrennt",

  whatsappContact: "Kontakt über WhatsApp",
  whatsappMessage: "Hallo, ich habe eine Frage zu DX Daruma...",

  heroTitle: "Ihr DX-Radar in Echtzeit",
  heroSubtitle: "Multi-Source DX-Spots, sporadische Alarme, WebSDR Self-Monitor, Multiplikator-Tracking — alles für Contest und DX.",
  enterApp: "Zur Anwendung",
  login: "Anmelden",
  signupFree: "Kostenlos registrieren",
  documentation: "Dokumentation",
  featuresTitle: "Funktionen",
  featureCluster: "Multi-Source DX Cluster",
  featureClusterDesc: "Echtzeit-Spots von Spothole, DX Summit und PSK Reporter, zusammengeführt und dedupliziert.",
  featureMonitor: "WebSDR Self-Monitor",
  featureMonitorDesc: "Hören Sie Ihr Signal auf entfernten Empfängern, um Ihre Audioqualität zu prüfen.",
  featureMultipliers: "Multiplikator-Tracking",
  featureMultipliersDesc: "Vollständiges Multiplikator-Raster pro Contest (WPX, WW, IARU, REF) mit Alarmen.",
  featurePropagation: "Ausbreitungsalarme",
  featurePropagationDesc: "Automatische Erkennung sporadischer Öffnungen (Es, TEP, Tropo, MS, Aurora).",
  featureWintest: "Win-Test Integration",
  featureWintestDesc: "DX Cluster Feed kompatibel mit Win-Test/DXLog über WebSocket Relay.",
  featureMultilang: "Mehrsprachig",
  featureMultilangDesc: "Oberfläche verfügbar in Französisch, Englisch, Deutsch, Polnisch, Spanisch und Italienisch.",
  pricingTitle: "Preise",
  pricingSubtitle: "Kostenloser Zugang zum Cluster. Alle Funktionen mit Premium freischalten.",
  planFree: "Kostenlos",
  planPremium: "Premium",
  year: "Jahr",
  planFreeF1: "DX Cluster Feed in Echtzeit",
  planFreeF2: "Band- und Modusfilter",
  planFreeF3: "Mehrsprachige Oberfläche",
  planPremF1: "Alles aus Kostenlos",
  planPremF2: "WebSDR Self-Monitor",
  planPremF3: "Vollständiges Multiplikator-Tracking",
  planPremF4: "Sporadische Ausbreitungsalarme",
  planPremF5: "Win-Test/DXLog Integration",
  planPremF6: "Kostenlose Updates auf Lebenszeit",
  upgradePremium: "Premium upgraden (50$/Jahr)",
  paypalNote: "Zahlung via PayPal. Zugang wird manuell innerhalb von 24h aktiviert.",
  premiumRequired: "Premium-Funktion erforderlich",

  locatorTitle: "Ihr QTH Locator",
  locatorDesc: "Geben Sie Ihren Maidenhead-Locator ein, um Entfernungs- und Azimutberechnungen anzupassen.",
  invalidLocator: "Ungültiger Locator (z.B. JN18du)",
  errorSaving: "Fehler beim Speichern",
  save: "Speichern",

  pilot: "Steuerung",
  forecast7d: "7-Tage-Prognose",
  plan24h: "24h-Plan",
  dxMap: "DX-Karte",
  bandActivity: "Bandaktivität",
  continentOpenings: "Kontinent-Öffnungen",
  ft8Propagation: "FT8-Ausbreitung (Echtzeit)",
  resetFilters: "Zurücksetzen",
  noSpotMatch: "Keine Spots entsprechen den Filtern.",
  online: "Online",

  selfMonitor: "Self-Monitor",
  selfMonitorDesc: "Intelligentes WebSDR-Hören",
  freqKhz: "Freq. (kHz)",
  bearing: "Azimut",
  pathSP: "Short Path",
  pathLP: "Long Path",
  local: "Lokal",
  distant: "Entfernt",
  islands: "Inseln",
  searchSdr: "Suchen",
  noSdrFound: "Kein SDR gefunden",
  listenSdr: "Hören",
  favorite: "Favorit",
  deleteSdr: "Löschen",

    // Profile
  profileTitle: "Mein Profil",
  profileInfo: "Informationen",
  profileName: "Name",
  profileEmail: "E-Mail",
  profileMemberSince: "Mitglied seit",
  profileSubscription: "Abonnement",
  profilePremium: "Premium",
  profileFree: "Kostenlos",
  profileExpiresOn: "Läuft ab am",
  profileUpgradeMsg: "Upgraden Sie auf Premium für Zugang zu Self-Monitor, Steuerung, Multiplikatoren, Vorhersagen und sporadischen Warnungen.",
  profileViewPricing: "Preise ansehen",
  profileLocatorTitle: "QTH Locator",
  profileLocatorDesc: "Ihr Maidenhead-Locator wird für personalisierte Entfernungs-, Azimut- und Ausbreitungsberechnungen verwendet.",
  profileLocatorCurrent: "Aktueller Locator",
  profileSave: "Speichern",
  profileBack: "Zurück zum Radar",
  profileLoginRequired: "Anmeldung erforderlich",
  profileLoginMsg: "Melden Sie sich an, um auf Ihr Profil zuzugreifen.",
  profileLoginBtn: "Anmelden",
  // Locator prompt modal
  locatorPromptTitle: "Willkommen bei DX Daruma!",
  locatorPromptSubtitle: "Um Ausbreitungsberechnungen, Entfernungen und Peilungen anzupassen, geben Sie bitte Ihren Maidenhead-Locator ein.",
  locatorPromptPlaceholder: "z.B. JN18du",
  locatorPromptHelp: "Ihr Locator (4 oder 6 Zeichen) finden Sie auf QRZ.com oder über Ihr GPS. Er wird zur Berechnung von Entfernungen und Peilungen zu DX-Stationen verwendet.",
  locatorPromptSave: "Meinen Locator speichern",
  locatorPromptSkip: "Später",
  locatorPromptInvalid: "Ungültiges Format. Beispiel: JN18du (4 oder 6 Zeichen).",
  // Spot distance
  distance: "Entf.",
  azimuth: "Az.",
  // General
  close: "Schließen",
  loading: "Laden...",
  error: "Fehler",
  ago: "vor",
  min: "Min",
  sec: "s",
};
const pl: TranslationKeys = {
  appName: "DX Daruma",
  appSubtitle: "Radar DX stacji · Priorytet SSB",
  utc: "UTC",
  refresh: "Odśwież",
  total: "Razem",
  rare: "Rzadkie",

  filters: "Filtry",
  bands: "Pasma",
  bandsHf: "KF",
  bandsVhf: "VHF/UHF",
  modes: "Tryby",
  continents: "Kontynenty",
  rareOnly: "Tylko rzadkie",
  search: "Szukaj",
  searchPlaceholder: "Znak, kraj, tryb...",
  sound: "Dźwięk",
  sporadicAlert: "Alert sporadyczny",
  prioritizeSsb: "Priorytet SSB",
  onlyNewDxcc: "Tylko nowe DXCC",

  propagationAlert: "ALERT PROPAGACJI",
  sporadicE: "Sporadyczne E",
  tep: "TEP",
  tropo: "Tropo",
  meteorScatter: "Meteor Scatter",
  aurora: "Aurora",
  f2Layer: "Warstwa F2",
  backscatter: "Backscatter",
  unknownProp: "Nieznany",
  openingSince: "Otwarcie od",
  stations: "Stacje",
  direction: "Kierunek",
  maxDistance: "Maks. odległość",
  confidence: "Pewność",
  high: "Wysoka",
  medium: "Średnia",
  low: "Niska",
  noOpenings: "Brak wykrytych otwarć",
  vhfActivity: "Aktywność VHF",

  spotDetail: "Szczegóły spotu",
  frequency: "Częstotliwość",
  mode: "Tryb",
  country: "Kraj",
  continent: "Kontynent",
  spotter: "Spotter",
  comment: "Komentarz",
  time: "Czas",
  listenOn: "Słuchaj na",

  multipliers: "Mnożniki",
  workedBands: "Pracowane pasma",
  notHeard: "Jeszcze nie słyszano",
  heardOn: "Słyszano na",
  department: "Departament",
  noSpotsYet: "Brak spotów dla tego mnożnika",

  connected: "Połączono",
  connecting: "Łączenie...",
  disconnected: "Rozłączono",

  whatsappContact: "Kontakt przez WhatsApp",
  whatsappMessage: "Cześć, mam pytanie o DX Daruma...",

  heroTitle: "Twój radar DX w czasie rzeczywistym",
  heroSubtitle: "Wieloźródłowe spoty DX, alerty sporadyczne, WebSDR Self-Monitor, śledzenie mnożników — wszystko do contestów i DX.",
  enterApp: "Wejdź do aplikacji",
  login: "Zaloguj się",
  signupFree: "Zarejestruj się za darmo",
  documentation: "Dokumentacja",
  featuresTitle: "Funkcje",
  featureCluster: "Wieloźródłowy DX Cluster",
  featureClusterDesc: "Spoty w czasie rzeczywistym ze Spothole, DX Summit i PSK Reporter, połączone i zdeduplikowane.",
  featureMonitor: "WebSDR Self-Monitor",
  featureMonitorDesc: "Słuchaj swojego sygnału na zdalnych odbiornikach, aby sprawdzić jakość audio.",
  featureMultipliers: "Śledzenie mnożników",
  featureMultipliersDesc: "Pełna siatka mnożników na contest (WPX, WW, IARU, REF) z alertami.",
  featurePropagation: "Alerty propagacji",
  featurePropagationDesc: "Automatyczne wykrywanie otwarć sporadycznych (Es, TEP, Tropo, MS, Aurora).",
  featureWintest: "Integracja Win-Test",
  featureWintestDesc: "Feed DX Cluster kompatybilny z Win-Test/DXLog przez WebSocket relay.",
  featureMultilang: "Wielojęzyczny",
  featureMultilangDesc: "Interfejs dostępny po francusku, angielsku, niemiecku, polsku, hiszpańsku i włosku.",
  pricingTitle: "Cennik",
  pricingSubtitle: "Darmowy dostęp do clustera. Odblokuj wszystkie funkcje z Premium.",
  planFree: "Darmowy",
  planPremium: "Premium",
  year: "rok",
  planFreeF1: "Feed DX Cluster w czasie rzeczywistym",
  planFreeF2: "Filtry pasm i trybów",
  planFreeF3: "Wielojęzyczny interfejs",
  planPremF1: "Wszystko z planu Darmowego",
  planPremF2: "WebSDR Self-Monitor",
  planPremF3: "Pełne śledzenie mnożników",
  planPremF4: "Alerty propagacji sporadycznej",
  planPremF5: "Integracja Win-Test/DXLog",
  planPremF6: "Darmowe aktualizacje dożywotnie",
  upgradePremium: "Upgrade Premium (50$/rok)",
  paypalNote: "Płatność przez PayPal. Dostęp aktywowany ręcznie w ciągu 24h.",
  premiumRequired: "Wymagana funkcja Premium",

  locatorTitle: "Twój QTH Locator",
  locatorDesc: "Wpisz swój lokator Maidenhead, aby spersonalizować obliczenia odległości i azymutu.",
  invalidLocator: "Nieprawidłowy lokator (np. JN18du)",
  errorSaving: "Błąd zapisu",
  save: "Zapisz",

  pilot: "Sterowanie",
  forecast7d: "Prognoza 7-dniowa",
  plan24h: "Plan 24h",
  dxMap: "Mapa DX",
  bandActivity: "Aktywność na pasmach",
  continentOpenings: "Otwarcia kontynentów",
  ft8Propagation: "Propagacja FT8 (czas rzeczywisty)",
  resetFilters: "Resetuj",
  noSpotMatch: "Brak spotów pasujących do filtrów.",
  online: "Online",

  selfMonitor: "Self-Monitor",
  selfMonitorDesc: "Inteligentne słuchanie WebSDR",
  freqKhz: "Częst. (kHz)",
  bearing: "Azymut",
  pathSP: "Short Path",
  pathLP: "Long Path",
  local: "Lokalny",
  distant: "Daleki",
  islands: "Wyspy",
  searchSdr: "Szukaj",
  noSdrFound: "Nie znaleziono SDR",
  listenSdr: "Słuchaj",
  favorite: "Ulubiony",
  deleteSdr: "Usuń",

  close: "Zamknij",
    // Profile
  profileTitle: "Mój Profil",
  profileInfo: "Informacje",
  profileName: "Imię",
  profileEmail: "Email",
  profileMemberSince: "Członek od",
  profileSubscription: "Subskrypcja",
  profilePremium: "Premium",
  profileFree: "Darmowy",
  profileExpiresOn: "Wygasa",
  profileUpgradeMsg: "Przejdź na Premium, aby uzyskać dostęp do Self-Monitor, Pilotowania, Mnożników, Prognoz i alertów sporadycznych.",
  profileViewPricing: "Zobacz cennik",
  profileLocatorTitle: "QTH Locator",
  profileLocatorDesc: "Twój lokator Maidenhead jest używany do obliczania spersonalizowanych odległości, azymutów i zaleceń propagacyjnych.",
  profileLocatorCurrent: "Aktualny lokator",
  profileSave: "Zapisz",
  profileBack: "Powrót do Radaru",
  profileLoginRequired: "Wymagane logowanie",
  profileLoginMsg: "Zaloguj się, aby uzyskać dostęp do profilu.",
  profileLoginBtn: "Zaloguj się",
  // Locator prompt modal
  locatorPromptTitle: "Witamy w DX Daruma!",
  locatorPromptSubtitle: "Aby spersonalizować obliczenia propagacji, odległości i azymutów, wprowadź swój lokator Maidenhead.",
  locatorPromptPlaceholder: "Np. JN18du",
  locatorPromptHelp: "Twój lokator (4 lub 6 znaków) znajdziesz na QRZ.com lub przez GPS. Służy do obliczania odległości i azymutów do stacji DX.",
  locatorPromptSave: "Zapisz mój lokator",
  locatorPromptSkip: "Później",
  locatorPromptInvalid: "Nieprawidłowy format. Przykład: JN18du (4 lub 6 znaków).",
  // Spot distance
  distance: "Odl.",
  azimuth: "Az.",
  // General
  loading: "Ładowanie...",
  error: "Błąd",
  ago: "temu",
  min: "min",
  sec: "s",
};
const es: TranslationKeys = {
  appName: "DX Daruma",
  appSubtitle: "El radar DX de la estación · Prioridad SSB",
  utc: "UTC",
  refresh: "Actualizar",
  total: "Total",
  rare: "Raros",

  filters: "Filtros",
  bands: "Bandas",
  bandsHf: "HF",
  bandsVhf: "VHF/UHF",
  modes: "Modos",
  continents: "Continentes",
  rareOnly: "Solo raros",
  search: "Buscar",
  searchPlaceholder: "Indicativo, país, modo...",
  sound: "Sonido",
  sporadicAlert: "Alerta esporádica",
  prioritizeSsb: "Prioridad SSB",
  onlyNewDxcc: "Solo DXCC nuevos",

  propagationAlert: "ALERTA DE PROPAGACIÓN",
  sporadicE: "Esporádica E",
  tep: "TEP",
  tropo: "Tropo",
  meteorScatter: "Meteor Scatter",
  aurora: "Aurora",
  f2Layer: "Capa F2",
  backscatter: "Backscatter",
  unknownProp: "Desconocido",
  openingSince: "Apertura desde",
  stations: "Estaciones",
  direction: "Dirección",
  maxDistance: "Distancia máx.",
  confidence: "Confianza",
  high: "Alta",
  medium: "Media",
  low: "Baja",
  noOpenings: "Sin aperturas detectadas",
  vhfActivity: "Actividad VHF",

  spotDetail: "Detalle del spot",
  frequency: "Frecuencia",
  mode: "Modo",
  country: "País",
  continent: "Continente",
  spotter: "Spotter",
  comment: "Comentario",
  time: "Hora",
  listenOn: "Escuchar en",

  multipliers: "Multiplicadores",
  workedBands: "Bandas trabajadas",
  notHeard: "Aún no escuchado",
  heardOn: "Escuchado en",
  department: "Departamento",
  noSpotsYet: "Sin spots para este multiplicador",

  connected: "Conectado",
  connecting: "Conectando...",
  disconnected: "Desconectado",

  whatsappContact: "Contactar por WhatsApp",
  whatsappMessage: "Hola, tengo una pregunta sobre DX Daruma...",

  heroTitle: "Tu radar DX en tiempo real",
  heroSubtitle: "Spots DX multi-fuente, alertas esporádicas, WebSDR Self-Monitor, seguimiento de multiplicadores — todo para contest y DX.",
  enterApp: "Entrar a la aplicación",
  login: "Iniciar sesión",
  signupFree: "Registrarse gratis",
  documentation: "Documentación",
  featuresTitle: "Características",
  featureCluster: "DX Cluster multi-fuente",
  featureClusterDesc: "Spots en tiempo real desde Spothole, DX Summit y PSK Reporter, fusionados y deduplicados.",
  featureMonitor: "WebSDR Self-Monitor",
  featureMonitorDesc: "Escuche su señal en receptores remotos para verificar su calidad de audio.",
  featureMultipliers: "Seguimiento de multiplicadores",
  featureMultipliersDesc: "Cuadrícula completa de multiplicadores por concurso (WPX, WW, IARU, REF) con alertas.",
  featurePropagation: "Alertas de propagación",
  featurePropagationDesc: "Detección automática de aperturas esporádicas (Es, TEP, Tropo, MS, Aurora).",
  featureWintest: "Integración Win-Test",
  featureWintestDesc: "Feed DX Cluster compatible con Win-Test/DXLog vía WebSocket relay.",
  featureMultilang: "Multilingüe",
  featureMultilangDesc: "Interfaz disponible en francés, inglés, alemán, polaco, español e italiano.",
  pricingTitle: "Precios",
  pricingSubtitle: "Acceso gratuito al cluster. Desbloquea todas las funciones con Premium.",
  planFree: "Gratuito",
  planPremium: "Premium",
  year: "año",
  planFreeF1: "Feed DX Cluster en tiempo real",
  planFreeF2: "Filtros de banda y modo",
  planFreeF3: "Interfaz multilingüe",
  planPremF1: "Todo del plan Gratuito",
  planPremF2: "WebSDR Self-Monitor",
  planPremF3: "Seguimiento completo de multiplicadores",
  planPremF4: "Alertas de propagación esporádica",
  planPremF5: "Integración Win-Test/DXLog",
  planPremF6: "Actualizaciones gratuitas de por vida",
  upgradePremium: "Upgrade Premium (50$/año)",
  paypalNote: "Pago vía PayPal. Acceso activado manualmente en 24h.",
  premiumRequired: "Función Premium requerida",

  locatorTitle: "Tu QTH Locator",
  locatorDesc: "Ingresa tu locator Maidenhead para personalizar los cálculos de distancia y azimut.",
  invalidLocator: "Locator inválido (ej: JN18du)",
  errorSaving: "Error al guardar",
  save: "Guardar",

  pilot: "Pilotaje",
  forecast7d: "Pronóstico 7 días",
  plan24h: "Plan 24h",
  dxMap: "Mapa DX",
  bandActivity: "Actividad por banda",
  continentOpenings: "Aperturas por continente",
  ft8Propagation: "Propagación FT8 (tiempo real)",
  resetFilters: "Reiniciar",
  noSpotMatch: "Ningún spot coincide con los filtros.",
  online: "En línea",

  selfMonitor: "Self-Monitor",
  selfMonitorDesc: "Escucha WebSDR inteligente",
  freqKhz: "Frec. (kHz)",
  bearing: "Azimut",
  pathSP: "Short Path",
  pathLP: "Long Path",
  local: "Local",
  distant: "Lejano",
  islands: "Islas",
  searchSdr: "Buscar",
  noSdrFound: "Ningún SDR encontrado",
  listenSdr: "Escuchar",
  favorite: "Favorito",
  deleteSdr: "Eliminar",

    // Profile
  profileTitle: "Mi Perfil",
  profileInfo: "Información",
  profileName: "Nombre",
  profileEmail: "Email",
  profileMemberSince: "Miembro desde",
  profileSubscription: "Suscripción",
  profilePremium: "Premium",
  profileFree: "Gratuito",
  profileExpiresOn: "Expira el",
  profileUpgradeMsg: "Actualice a Premium para acceder a Self-Monitor, Pilotaje, Multiplicadores, Pronósticos y alertas esporádicas.",
  profileViewPricing: "Ver precios",
  profileLocatorTitle: "QTH Locator",
  profileLocatorDesc: "Su locator Maidenhead se usa para calcular distancias, azimuts y recomendaciones de propagación personalizadas.",
  profileLocatorCurrent: "Locator actual",
  profileSave: "Guardar",
  profileBack: "Volver al Radar",
  profileLoginRequired: "Inicio de sesión requerido",
  profileLoginMsg: "Inicie sesión para acceder a su perfil.",
  profileLoginBtn: "Iniciar sesión",
  // Locator prompt modal
  locatorPromptTitle: "¡Bienvenido a DX Daruma!",
  locatorPromptSubtitle: "Para personalizar los cálculos de propagación, distancias y azimuts, introduce tu locator Maidenhead.",
  locatorPromptPlaceholder: "Ej. JN18du",
  locatorPromptHelp: "Tu locator (4 o 6 caracteres) se encuentra en QRZ.com o a través de tu GPS. Se utiliza para calcular distancias y azimuts hacia estaciones DX.",
  locatorPromptSave: "Guardar mi locator",
  locatorPromptSkip: "Más tarde",
  locatorPromptInvalid: "Formato inválido. Ejemplo: JN18du (4 o 6 caracteres).",
  // Spot distance
  distance: "Dist.",
  azimuth: "Az.",
  // General
  close: "Cerrar",
  loading: "Cargando...",
  error: "Error",
  ago: "hace",
  min: "min",
  sec: "s",
};
const it: TranslationKeys = {
  appName: "DX Daruma",
  appSubtitle: "Il radar DX della stazione · Priorità SSB",
  utc: "UTC",
  refresh: "Aggiorna",
  total: "Totale",
  rare: "Rari",

  filters: "Filtri",
  bands: "Bande",
  bandsHf: "HF",
  bandsVhf: "VHF/UHF",
  modes: "Modi",
  continents: "Continenti",
  rareOnly: "Solo rari",
  search: "Cerca",
  searchPlaceholder: "Nominativo, paese, modo...",
  sound: "Suono",
  sporadicAlert: "Allerta sporadica",
  prioritizeSsb: "Priorità SSB",
  onlyNewDxcc: "Solo DXCC nuovi",

  propagationAlert: "ALLERTA PROPAGAZIONE",
  sporadicE: "Sporadica E",
  tep: "TEP",
  tropo: "Tropo",
  meteorScatter: "Meteor Scatter",
  aurora: "Aurora",
  f2Layer: "Strato F2",
  backscatter: "Backscatter",
  unknownProp: "Sconosciuto",
  openingSince: "Apertura da",
  stations: "Stazioni",
  direction: "Direzione",
  maxDistance: "Distanza max",
  confidence: "Affidabilità",
  high: "Alta",
  medium: "Media",
  low: "Bassa",
  noOpenings: "Nessuna apertura rilevata",
  vhfActivity: "Attività VHF",

  spotDetail: "Dettaglio spot",
  frequency: "Frequenza",
  mode: "Modo",
  country: "Paese",
  continent: "Continente",
  spotter: "Spotter",
  comment: "Commento",
  time: "Ora",
  listenOn: "Ascolta su",

  multipliers: "Moltiplicatori",
  workedBands: "Bande lavorate",
  notHeard: "Non ancora sentito",
  heardOn: "Sentito su",
  department: "Dipartimento",
  noSpotsYet: "Nessun spot per questo moltiplicatore",

  connected: "Connesso",
  connecting: "Connessione...",
  disconnected: "Disconnesso",

  whatsappContact: "Contatta via WhatsApp",
  whatsappMessage: "Ciao, ho una domanda su DX Daruma...",

  heroTitle: "Il tuo radar DX in tempo reale",
  heroSubtitle: "Spot DX multi-sorgente, allerte sporadiche, WebSDR Self-Monitor, tracciamento moltiplicatori — tutto per contest e DX.",
  enterApp: "Entra nell'applicazione",
  login: "Accedi",
  signupFree: "Registrati gratis",
  documentation: "Documentazione",
  featuresTitle: "Funzionalità",
  featureCluster: "DX Cluster multi-sorgente",
  featureClusterDesc: "Spot in tempo reale da Spothole, DX Summit e PSK Reporter, uniti e deduplicati.",
  featureMonitor: "WebSDR Self-Monitor",
  featureMonitorDesc: "Ascolta il tuo segnale su ricevitori remoti per verificare la qualità audio.",
  featureMultipliers: "Tracciamento moltiplicatori",
  featureMultipliersDesc: "Griglia completa dei moltiplicatori per contest (WPX, WW, IARU, REF) con allerte.",
  featurePropagation: "Allerte propagazione",
  featurePropagationDesc: "Rilevamento automatico delle aperture sporadiche (Es, TEP, Tropo, MS, Aurora).",
  featureWintest: "Integrazione Win-Test",
  featureWintestDesc: "Feed DX Cluster compatibile con Win-Test/DXLog tramite WebSocket relay.",
  featureMultilang: "Multilingue",
  featureMultilangDesc: "Interfaccia disponibile in francese, inglese, tedesco, polacco, spagnolo e italiano.",
  pricingTitle: "Prezzi",
  pricingSubtitle: "Accesso gratuito al cluster. Sblocca tutte le funzionalità con Premium.",
  planFree: "Gratuito",
  planPremium: "Premium",
  year: "anno",
  planFreeF1: "Feed DX Cluster in tempo reale",
  planFreeF2: "Filtri per banda e modo",
  planFreeF3: "Interfaccia multilingue",
  planPremF1: "Tutto dal piano Gratuito",
  planPremF2: "WebSDR Self-Monitor",
  planPremF3: "Tracciamento completo moltiplicatori",
  planPremF4: "Allerte propagazione sporadica",
  planPremF5: "Integrazione Win-Test/DXLog",
  planPremF6: "Aggiornamenti gratuiti a vita",
  upgradePremium: "Upgrade Premium (50$/anno)",
  paypalNote: "Pagamento via PayPal. Accesso attivato manualmente entro 24h.",
  premiumRequired: "Funzionalità Premium richiesta",

  locatorTitle: "Il tuo QTH Locator",
  locatorDesc: "Inserisci il tuo locator Maidenhead per personalizzare i calcoli di distanza e azimut.",
  invalidLocator: "Locator non valido (es: JN18du)",
  errorSaving: "Errore durante il salvataggio",
  save: "Salva",

  pilot: "Pilotaggio",
  forecast7d: "Previsioni 7 giorni",
  plan24h: "Piano 24h",
  dxMap: "Mappa DX",
  bandActivity: "Attività per banda",
  continentOpenings: "Aperture per continente",
  ft8Propagation: "Propagazione FT8 (tempo reale)",
  resetFilters: "Reimposta",
  noSpotMatch: "Nessun spot corrisponde ai filtri.",
  online: "Online",

  selfMonitor: "Self-Monitor",
  selfMonitorDesc: "Ascolto WebSDR intelligente",
  freqKhz: "Freq. (kHz)",
  bearing: "Azimut",
  pathSP: "Short Path",
  pathLP: "Long Path",
  local: "Locale",
  distant: "Distante",
  islands: "Isole",
  searchSdr: "Cerca",
  noSdrFound: "Nessun SDR trovato",
  listenSdr: "Ascolta",
  favorite: "Preferito",
  deleteSdr: "Elimina",

    // Profile
  profileTitle: "Il Mio Profilo",
  profileInfo: "Informazioni",
  profileName: "Nome",
  profileEmail: "Email",
  profileMemberSince: "Membro dal",
  profileSubscription: "Abbonamento",
  profilePremium: "Premium",
  profileFree: "Gratuito",
  profileExpiresOn: "Scade il",
  profileUpgradeMsg: "Passa a Premium per accedere a Self-Monitor, Pilotaggio, Moltiplicatori, Previsioni e avvisi sporadici.",
  profileViewPricing: "Vedi prezzi",
  profileLocatorTitle: "QTH Locator",
  profileLocatorDesc: "Il tuo locator Maidenhead viene utilizzato per calcolare distanze, azimut e raccomandazioni di propagazione personalizzate.",
  profileLocatorCurrent: "Locator attuale",
  profileSave: "Salva",
  profileBack: "Torna al Radar",
  profileLoginRequired: "Accesso richiesto",
  profileLoginMsg: "Accedi per visualizzare il tuo profilo.",
  profileLoginBtn: "Accedi",
  // Locator prompt modal
  locatorPromptTitle: "Benvenuto su DX Daruma!",
  locatorPromptSubtitle: "Per personalizzare i calcoli di propagazione, distanze e azimut, inserisci il tuo locator Maidenhead.",
  locatorPromptPlaceholder: "Es. JN18du",
  locatorPromptHelp: "Il tuo locator (4 o 6 caratteri) si trova su QRZ.com o tramite il tuo GPS. Viene utilizzato per calcolare distanze e azimut verso le stazioni DX.",
  locatorPromptSave: "Salva il mio locator",
  locatorPromptSkip: "Più tardi",
  locatorPromptInvalid: "Formato non valido. Esempio: JN18du (4 o 6 caratteri).",
  // Spot distance
  distance: "Dist.",
  azimuth: "Az.",
  // General
  close: "Chiudi",
  loading: "Caricamento...",
  error: "Errore",
  ago: "fa",
  min: "min",
  sec: "s",
};
const translations: Record<Locale, TranslationKeys> = { fr, en, de, pl, es, it };

export type TranslationKey = keyof TranslationKeys;

export function getTranslations(locale: Locale): TranslationKeys {
  return translations[locale] || translations.fr;
}

export function getStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem("dx-daruma-locale");
    if (stored && LOCALES.some(l => l.code === stored)) return stored as Locale;
  } catch {}
  // Detect browser language
  const nav = navigator.language?.slice(0, 2)?.toLowerCase();
  if (nav && LOCALES.some(l => l.code === nav)) return nav as Locale;
  return "fr";
}

export function setStoredLocale(locale: Locale) {
  try {
    localStorage.setItem("dx-daruma-locale", locale);
  } catch {}
}
