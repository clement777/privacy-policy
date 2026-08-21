// ─────────────────────────────────────────────────────────────────────────────
// Le dictionnaire.
//
// Le français est la source : c'est lui qui définit l'ensemble des clés, et
// `en` est typé `Record<StringKey, string>` — il devient donc IMPOSSIBLE de
// compiler après avoir ajouté une chaîne française sans son anglais. C'est la
// seule protection qui tienne dans la durée ; une traduction se désynchronise
// toujours par oubli, jamais par intention.
//
// Les valeurs entre accolades sont des paramètres : `{n}`, `{ml}`… Voir `t()`.
// Les libellés en capitales le restent dans les deux langues — c'est une
// décision de design, pas de langue.
// ─────────────────────────────────────────────────────────────────────────────

export const fr = {
  // ── Onglets ───────────────────────────────────────────────────────────────
  'tab.bar': 'BARRE',
  'tab.data': 'DONNÉES',
  'tab.widgets': 'WIDGETS',

  // ── Commun ────────────────────────────────────────────────────────────────
  'common.next': 'SUIVANT',
  'common.back': 'RETOUR',
  'common.backArrow': '← Retour',
  'common.start': 'COMMENCER',
  'common.letsGo': "C'EST PARTI",
  'common.cancel': 'Annuler',
  'common.continue': 'Continuer',
  'common.delete': 'Supprimer',
  'common.error': 'Erreur',
  'common.gotIt': 'COMPRIS',
  'common.gotItLong': "J'AI COMPRIS",
  'common.close': 'FERMER',
  'common.custom': 'PERSONNALISÉ',
  'common.male': 'HOMME',
  'common.female': 'FEMME',
  'common.maleShort': 'H',
  'common.femaleShort': 'F',
  'common.perDay': 'jour',
  'common.details': 'Détails : {label}',
  'splash.loadingProfile': 'Récupération de ton profil…',
  'bar.saturated': '  ·  SATURÉ',
  'home.alcoholLightSub': '2–8°',
  'home.alcoholMediumSub': '9–22°',
  'widget.water': '＋ EAU',
  'widget.alcohol': 'ALCOOL',
  'widget.btnLight': 'LÉGER 2–8°',
  'widget.btnMedium': 'MOYEN 9–22°',
  'widget.btnStrong': 'FORT 30–45°',

  // ── Zones ─────────────────────────────────────────────────────────────────
  'zone.green': 'HYDRATÉ',
  'zone.amber': 'TU SÈCHES',
  'zone.red': 'CRITIQUE',
  'zone.poison': 'EMPOISONNÉ',

  // ── Questionnaire : titres d'étapes ───────────────────────────────────────
  'onb.step.language': 'LANGUE',
  'onb.step.welcome': 'BIENVENUE',
  'onb.step.you': 'TOI',
  'onb.step.rhythm': 'TON RYTHME',
  'onb.step.environment': 'ENVIRONNEMENT',
  'onb.step.water': 'TON EAU',
  'onb.step.state': 'ÉTAT',
  'onb.step.recap': 'RÉCAP',
  'onb.kicker': 'ÉTAPE {n}/{total}',

  // ── Questionnaire : langue ────────────────────────────────────────────────
  'onb.language.help':
    "Choisis ta langue. Tu pourras en changer à tout moment dans WIDGETS → LANGUE.",

  // ── Questionnaire : bienvenue ─────────────────────────────────────────────
  'onb.welcome.tagline': 'Ta barre de vie hydrique, en temps réel.',
  'onb.welcome.body':
    "HYDRA calcule ton hydratation à partir de ta physiologie : ton poids, ton effort, la chaleur, l'alcool… Pour que la barre colle à TA réalité, on a besoin de quelques infos.",
  'onb.welcome.duration':
    'Ça prend 30 secondes. Tout est modifiable ensuite dans WIDGETS → PROFIL.',
  'onb.welcome.haveAccount': 'Déjà un compte ? Se connecter',
  'onb.welcome.signedInNote':
    "Tu es connecté, mais ce compte n'a pas encore de profil HYDRA. Complète le questionnaire, ou change de compte.",
  'onb.welcome.otherAccount': 'Utiliser un autre compte',

  // ── Questionnaire : toi ───────────────────────────────────────────────────
  'onb.you.help':
    "Le poids et le sexe déterminent ton besoin quotidien et ta perte de sueur à l'effort.",
  'onb.you.sex': 'SEXE',
  'onb.you.weight': 'POIDS',
  'onb.you.needPreview': 'BESOIN QUOTIDIEN ESTIMÉ · {ml} mL',

  // ── Questionnaire : rythme ────────────────────────────────────────────────
  'onb.rhythm.help':
    "Indique tes horaires de sommeil. Tes heures d'éveil en sont déduites automatiquement — la barre ralentit la nuit.",
  'onb.rhythm.bedtime': 'COUCHER',
  'onb.rhythm.wakeup': 'RÉVEIL',
  'onb.rhythm.preview': '≈ {awake}h ÉVEILLÉ · {sleep}h DE SOMMEIL',

  // ── Questionnaire : environnement ─────────────────────────────────────────
  'onb.env.help':
    "La chaleur et l'humidité augmentent la sueur. Optionnel — tu peux passer et le régler plus tard.",
  'onb.env.switch': 'RENSEIGNER MON ENVIRONNEMENT',
  'onb.env.temp': 'TEMPÉRATURE AMBIANTE',
  'onb.env.humidity': 'HUMIDITÉ RELATIVE',
  'onb.env.altitude': 'ALTITUDE',

  // ── Questionnaire : eau ───────────────────────────────────────────────────
  'onb.water.help':
    "Ton contenant habituel : un tap dans le widget = ce volume d'eau enregistré.",
  'onb.water.customLabel': 'VOLUME PERSONNALISÉ',
  'onb.water.placeholder': 'ex. 400',
  'onb.water.range': 'Entre {min} et {max} mL.',

  // ── Questionnaire : état ──────────────────────────────────────────────────
  'onb.state.help':
    'On ne te connaît pas encore. Dis-nous comment tu te sens maintenant — la barre démarre là, pas à 100 %.',
  'onb.feeling.good': 'BIEN',
  'onb.feeling.good.hint': 'Hydraté, en forme',
  'onb.feeling.ok': 'MOYEN',
  'onb.feeling.ok.hint': 'Un peu fatigué / soif',
  'onb.feeling.dry': 'ASSÉCHÉ',
  'onb.feeling.dry.hint': 'Soif, tête lourde',

  // ── Questionnaire : récap ─────────────────────────────────────────────────
  'onb.recap.help': 'Tout est prêt. Vérifie et démarre.',
  'onb.recap.sex': 'Sexe',
  'onb.recap.weight': 'Poids',
  'onb.recap.need': 'Besoin / jour',
  'onb.recap.sleep': 'Sommeil',
  'onb.recap.awake': 'Éveil / jour',
  'onb.recap.environment': 'Environnement',
  'onb.recap.container': 'Contenant eau',
  'onb.recap.startState': 'État de départ',
  'onb.recap.defaults': 'Par défaut',
  'onb.recap.male': 'Homme',
  'onb.recap.female': 'Femme',

  // ── Questionnaire : préparation ───────────────────────────────────────────
  'onb.prep.1': 'On calcule ton besoin quotidien à partir de ton poids…',
  'onb.prep.2': 'On ajuste selon ta fenêtre de sommeil…',
  'onb.prep.3': 'On intègre ta température et ton humidité ambiantes…',
  'onb.prep.4': "On prépare ta répartition de consommation d'eau dans la journée…",
  'onb.prep.5': 'On cale ta barre de vie sur ton rythme de sommeil…',
  'onb.prep.6': "On règle ton plafond d'absorption horaire…",
  'onb.prep.7': "On paramètre l'impact de l'alcool sur ta barre…",
  'onb.prep.8': 'On calibre tes rappels par verre…',
  'onb.prep.9': 'Ton profil est prêt.',
  'onb.prep.goal': 'OBJECTIF ESTIMÉ · {ml} mL / JOUR',

  // ── Accueil ───────────────────────────────────────────────────────────────
  'home.streak': '🌊 VAGUE {n}J',
  'home.streakEmpty': '🌊 LANCE TA VAGUE',
  'home.streakA11y': 'Détails de ta vague',
  'home.logoA11y': 'Logo HYDRA',
  'home.redIn': 'ROUGE DANS',
  'home.saturated': 'SATURÉ · ton corps ne peut pas absorber plus vite.',
  'home.saturatedWait': 'Attends encore {timer} avant de reboire de l’eau.',
  'home.water': 'EAU',
  'home.alcoholLight': 'ALCOOL LÉGER',
  'home.alcoholMedium': 'ALCOOL MOYEN',
  'home.alcoholStrong': 'ALCOOL FORT',
  'home.alcoholStrongSub': '30–45°  spiritueux',
  'home.sport': 'SPORT',
  'home.sportRunning': 'séance en cours',
  'home.sportIdle': 'modéré ou intense · durée',
  'home.undo': 'ANNULER LE DERNIER AJOUT',
  'home.undoSub': 'retire eau, alcool ou sport',
  'home.sessionBlocked': 'SÉANCE EN COURS · termine dans {time}',
  'home.sessionStarted': 'SÉANCE DÉMARRÉE · {min} min · sueur en cours',
  'home.footHint':
    'Besoin quotidien : {need} mL ({kg} kg × 32) · absorbé cette heure {used}/{cap} mL',

  // ── Sport ─────────────────────────────────────────────────────────────────
  'sport.title': 'SPORT',
  'sport.intensity': 'INTENSITÉ',
  'sport.duration': 'DURÉE',
  'sport.moderate': 'MODÉRÉ',
  'sport.intense': 'INTENSE',
  'sport.light': 'LÉGER',
  'sport.hint':
    'La séance démarre maintenant — la barre descend plus vite pendant la durée choisie.',
  'sport.confirm': 'DÉMARRER LA SÉANCE',
  'sport.active': 'SÉANCE EN COURS',
  'sport.sweatLine': '−{ml} mL/h sueur · {time} restantes',

  // ── Données ───────────────────────────────────────────────────────────────
  'data.title': 'DONNÉES',
  'data.drunkToday': "BU AUJOURD'HUI",
  'data.glasses': 'VERRES',
  'data.greenTime': 'TEMPS DANS LE VERT',
  'data.wave': 'LA VAGUE 🌊',
  'data.sinceStart': 'DEPUIS LE DÉBUT',
  'data.waterTotal': 'EAU BUE EN TOUT',
  'data.alcoholTotal': "VERRES D'ALCOOL EN TOUT",
  'data.sinceLine': 'Ton compteur total depuis le {date} — il ne fait que monter.',
  'data.sinceEmpty': 'Ton compteur total démarrera dès ton premier verre.',
  'data.last7': '7 DERNIERS JOURS',
  'data.goalHint': 'Objectif {ml} mL/j · barre pleine = objectif atteint',
  'data.poisoning': 'EMPOISONNEMENT',
  'data.purpleWeek': 'EN VIOLET (7 JOURS)',
  'data.alcoholFreeDays': 'JOURS SANS ALCOOL',
  'data.poisonHint': 'Objectif : le moins de temps en violet possible.',
  'data.last30': '30 DERNIERS JOURS',
  'data.waterDrunk': 'EAU BUE',
  'data.alcoholGlasses': "VERRES D'ALCOOL",
  'data.poisonedTime': 'TEMPS EMPOISONNÉ',
  'data.cleanDays': 'JOURS PROPRES',
  'data.day': 'JOURNÉE',
  'data.empty': "Aucun événement aujourd'hui.",
  'data.evt.water': 'EAU  {ml}ml',
  'data.evt.electrolytes': 'ÉLECTROLYTES  {ml}ml',
  'data.evt.alcohol': 'ALCOOL  {ml}ml / {abv}%',
  'data.evt.caffeine': 'CAFÉINE  {ml}ml',
  'data.evt.sport': 'SPORT {intensity}  {min}min',
  'data.evt.profile': 'PROFIL modifié',
  'data.durationMin': '{m} min',
  'data.durationHm': '{h} h {m}',
  /** Lettres des jours, dimanche → samedi. Une lettre par jour, dans l'ordre. */
  'data.weekdayLetters': 'D,L,M,M,J,V,S',

  // ── La vague (aide) ───────────────────────────────────────────────────────
  'wave.title': 'LA VAGUE 🌊',
  'wave.body':
    "Ta vague, c'est le nombre de jours de suite où tu as bu assez d'eau pour atteindre ton objectif du jour (environ {ml} mL, selon ton poids).\n\nChaque jour réussi fait grandir ta vague. Si tu n'as pas encore atteint l'objectif aujourd'hui, la vague des jours précédents est conservée — mais elle retombe à zéro dès qu'un jour passé n'a pas atteint l'objectif.\n\nGarde ta vague vivante : bois chaque jour.",

  // ── Widgets ───────────────────────────────────────────────────────────────
  'widgets.title': 'WIDGETS',
  'widgets.subtitle':
    "Le produit, c'est le widget. Cet écran est son poste de pilotage : aperçu, ajout, et les réglages qui l'alimentent.",
  'widgets.preview': 'APERÇU',
  'widgets.format.lock': 'VERROUILLAGE',
  'widgets.format.small': 'CARRÉ 2×2',
  'widgets.format.medium': 'BANDEAU 4×2',
  'widgets.state.live': 'DIRECT',
  'widgets.add': 'AJOUTER LE WIDGET',
  'widgets.addLock': "AJOUTER À L'ÉCRAN VERROUILLÉ",
  'widgets.addHome': "AJOUTER À L'ÉCRAN D'ACCUEIL",
  'widgets.refresh': 'RAFRAÎCHIR LE WIDGET',
  'widgets.refreshed': 'Widget rafraîchi.',
  'widgets.settings': 'RÉGLAGES WIDGET',
  'widgets.alcoholButtons': 'BOUTONS ALCOOL (BANDEAU)',
  'widgets.defaultContainer': 'CONTENANT EAU PAR DÉFAUT',
  'widgets.customShort': 'PERSO {ml} mL',
  'widgets.profile': 'PROFIL (ALIMENTE LE WIDGET)',
  'widgets.weight': 'POIDS (kg)',
  'widgets.sex': 'SEXE',
  'widgets.sleepStart': 'SOMMEIL DÉBUT',
  'widgets.sleepEnd': 'SOMMEIL FIN',
  'widgets.awakeAuto': 'HEURES ÉVEIL (AUTO)',
  'widgets.temp': 'TEMP AMBIANTE °C',
  'widgets.humidity': 'HUMIDITÉ %',
  'widgets.altitude': 'ALTITUDE (m)',
  'widgets.goal': 'OBJECTIF',
  'widgets.goalValue': '{ml} mL / jour ({kg} × 32)',
  'widgets.hours': '{h} h',
  'widgets.restart': 'REFAIRE LE QUESTIONNAIRE',
  'widgets.restartTitle': 'Refaire le questionnaire',
  'widgets.restartBody':
    'Tu vas repasser par la configuration guidée (poids, sexe, sommeil, environnement, contenant). Tes données actuelles restent enregistrées.',
  'widgets.notifications': 'NOTIFICATIONS',
  'widgets.glassReminders': 'RAPPELS PAR VERRE',
  'widgets.remindersHint':
    "Un rappel programmé pour chaque verre encore nécessaire aujourd'hui, étalé jusqu'à ton coucher ({h} h). Les alertes zone ambre/rouge restent actives dans tous les cas.",
  'widgets.language': 'LANGUE',
  'widgets.languageHint':
    "Change la langue de l'app et des notifications. Le widget suit au prochain rafraîchissement.",
  'widgets.account': 'COMPTE',
  'widgets.signedIn': 'CONNECTÉ',
  'widgets.signOut': 'SE DÉCONNECTER',
  'widgets.deleteAccount': 'SUPPRIMER LE COMPTE',
  'widgets.deleteTitle': 'Supprimer le compte',
  'widgets.deleteBody':
    'Toutes tes données (profil, historique) seront définitivement effacées. Cette action est irréversible.',
  'widgets.science': 'SCIENCE',
  'widgets.sources': 'SOURCES SCIENTIFIQUES',
  'widgets.disclaimer':
    "App grand public à but ludique et informatif. Ce n'est pas un dispositif médical. Les coefficients sont des moyennes de population. Consulte un professionnel de santé pour tout besoin d'hydratation spécifique.",

  // ── Guide d'ajout du widget ───────────────────────────────────────────────
  'guide.lock.title': "AJOUTER À L'ÉCRAN VERROUILLÉ",
  'guide.lock.1': "Verrouille ton iPhone, puis appuie longuement sur l'écran verrouillé.",
  'guide.lock.2': 'Touche « Personnaliser », puis « Écran verrouillé ».',
  'guide.lock.3': "Touche la zone sous l'heure, puis « + Ajouter des widgets ».",
  'guide.lock.4': 'Cherche « HYDRA » dans la liste et sélectionne-le.',
  'guide.lock.5': "Touche « OK » : la barre de vie apparaît sous l'heure.",
  'guide.home.title': "AJOUTER À L'ÉCRAN D'ACCUEIL",
  'guide.home.1': "Appuie longuement sur une zone vide de l'écran d'accueil.",
  'guide.home.2': 'Touche le « + » en haut à gauche.',
  'guide.home.3': 'Cherche « HYDRA » dans la liste des widgets.',
  'guide.home.4': 'Choisis le format (carré 2×2 ou bandeau 4×2).',
  'guide.home.5': 'Touche « Ajouter le widget », puis « OK ».',
  'guide.note':
    "iOS ne permet pas d'ajouter un widget automatiquement — ces étapes se font une seule fois, à la main. Ensuite HYDRA se met à jour tout seul.",

  // ── Paywall ───────────────────────────────────────────────────────────────
  'pay.tagline': 'Passe le moins de temps possible à sec.',
  'pay.prop1.title': 'Ta barre de vie',
  'pay.prop1.desc': 'Une barre qui se vide en temps réel. Bois pour la remplir.',
  'pay.prop2.title': "L'alcool est un poison",
  'pay.prop2.desc': 'Chaque verre accélère ta déshydratation. Vois l’impact réel.',
  'pay.prop3.title': 'Widget écran verrouillé',
  'pay.prop3.desc': "Ton hydratation en permanence sous les yeux, sans ouvrir l'app.",
  'pay.prop4.title': 'Moteur physiologique',
  'pay.prop4.desc':
    'Calculs basés sur ton corps et la vraie science, pas des points au hasard.',
  'pay.perPeriod': '{price}/{period}',
  'pay.thenPerPeriod': 'puis {price}/{period} · annulable à tout moment',
  'pay.plainPeriod': '{price}/{period} · annulable à tout moment',
  'pay.planMonthly': 'MENSUEL',
  'pay.planAnnual': 'ANNUEL',
  'pay.periodMonthShort': 'MOIS',
  'pay.periodMonth': 'mois',
  'pay.periodYearShort': 'AN',
  'pay.periodYear': 'an',
  'pay.accountNote':
    'Ton compte est bien créé. Il te reste à démarrer ton essai pour débloquer l’app.',
  'pay.access':
    "HYDRA est une app par abonnement : l'accès complet (barre en temps réel, widgets, historique) nécessite l'abonnement HYDRA Pro.",
  'pay.ctaTrial': "COMMENCER L'ESSAI GRATUIT",
  'pay.ctaSubscribe': "S'ABONNER",
  'pay.restore': 'Restaurer mes achats',
  'pay.signIn': 'Déjà un compte ? Se connecter',
  'pay.legalTrial':
    "Essai gratuit de {trial}. Sans annulation au moins 24 h avant la fin, l'abonnement se renouvelle automatiquement à {price}/{period}. ",
  'pay.legalPlain':
    'Abonnement à {price}/{period}, renouvelé automatiquement sauf annulation au moins 24 h avant la fin de la période. ',
  'pay.legalManage':
    'Gère ou annule l’abonnement dans les réglages de ton compte Apple.',
  'pay.terms': 'Conditions',
  'pay.privacy': 'Confidentialité',
  'pay.sourcesLink': 'Sources',
  'pay.signOut': 'Se déconnecter',
  'pay.noOffer': 'Offre indisponible pour le moment. Réessaie dans un instant.',
  'pay.trialDays': '{n} JOUR{s} GRATUIT{s}',
  'pay.trialWeeks': '{n} JOURS GRATUITS',
  'pay.trialMonths': '{n} MOIS GRATUIT{s}',
  'pay.trialYears': '{n} AN{s} GRATUIT{s}',

  // ── Achat : messages StoreKit ─────────────────────────────────────────────
  'purchase.unavailable': 'Achat indisponible ici.',
  'purchase.restoreUnavailable': 'Restauration indisponible ici.',
  'purchase.pending':
    'Achat en attente de validation (ta banque, ou « Demander à acheter »). Rien à refaire : HYDRA se débloque dès que c’est confirmé.',
  'purchase.alreadyOwned':
    'Tu as déjà cet abonnement. Utilise « Restaurer mes achats » juste en dessous.',
  'purchase.network': 'Connexion perdue. Vérifie ton réseau et réessaie.',
  'purchase.storeProblem':
    "L'App Store ne répond pas pour le moment. Réessaie dans un instant.",
  'purchase.notAllowed':
    "Les achats sont bloqués sur cet appareil (restrictions du Temps d'écran).",
  'purchase.productUnavailable':
    "Cette offre n'est pas disponible sur ton compte App Store.",
  'purchase.failed': "L'achat n'a pas abouti. Réessaie dans un instant.",
  'purchase.noEntitlement': 'Aucun abonnement actif sur ce compte Apple.',

  // ── Compte ────────────────────────────────────────────────────────────────
  'auth.taglineSignIn':
    'Reconnecte-toi pour retrouver ta progression et ton abonnement.',
  'auth.taglineSignUp':
    'Dernière étape : crée ton compte pour sauvegarder ta progression et retrouver ta barre sur tous tes appareils.',
  'auth.signIn': 'SE CONNECTER',
  'auth.signUp': 'CRÉER UN COMPTE',
  'auth.or': 'OU',
  'auth.email': 'Email',
  'auth.password': 'Mot de passe',
  'auth.invalid': 'Email valide + mot de passe de 6 caractères minimum.',
  'auth.created':
    'Compte créé. Vérifie ta boîte mail si une confirmation est demandée.',
  'auth.noSignUpHere':
    "Pas encore de compte ? Reviens en arrière : ton compte se crée une fois l'essai démarré.",
  'auth.toSignUp': 'Pas encore de compte ? Choisis CRÉER UN COMPTE en haut.',
  'auth.toSignIn': 'Déjà un compte ? Choisis SE CONNECTER en haut.',

  // ── Notifications ─────────────────────────────────────────────────────────
  'notif.nextGlass.title': 'VERRE SUIVANT.',
  'notif.nextGlass.many': 'Encore {n} verres pour tenir ton objectif du jour.',
  'notif.nextGlass.last': 'Dernier verre pour tenir ton objectif du jour.',
  'notif.amber.title': 'TU SÈCHES.',
  'notif.amber.body': 'La barre a franchi la zone ambre. Bois maintenant.',
  'notif.red.title': 'CRITIQUE.',
  'notif.red.body': 'HYDRA passe en rouge. Verre. Tout de suite.',

  // ── Sources scientifiques ─────────────────────────────────────────────────
  'src.title': 'SOURCES SCIENTIFIQUES',
  'src.intro':
    "HYDRA n'est pas un dispositif médical et ne pose aucun diagnostic. La barre est une estimation calculée à partir de coefficients publiés, qui sont des moyennes de population : ton corps peut s'en écarter. Pour tout besoin d'hydratation spécifique — grossesse, maladie rénale ou cardiaque, traitement diurétique, sport d'endurance encadré — parles-en à un professionnel de santé.",
  'src.note':
    "Les liens ouvrent la publication d'origine (DOI). Le détail des formules est également documenté dans le code du moteur de calcul.",
  'src.need.title': 'BESOIN QUOTIDIEN — 32 mL/kg',
  'src.need.what':
    "HYDRA fixe ta cible d'eau à 32 mL par kilo de poids corporel, la valeur médiane de la fourchette clinique de 30–35 mL/kg, cohérente avec les apports de référence européens une fois l'eau des aliments prise en compte.",
  'src.need.ref1': 'EFSA 2010 — Apports de référence pour l’eau',
  'src.need.ref2': 'Jéquier & Constant 2010 — Bases physiologiques',
  'src.absorb.title': 'PLAFOND D’ABSORPTION — ~1 L PAR HEURE',
  'src.absorb.what':
    "Boire un litre d'un coup n'hydrate pas plus vite que boire par gorgées : au-delà d'environ 1 L par heure glissante, l'excédent est excrété. HYDRA ne crédite donc la barre que jusqu'à ce plafond — c'est aussi pour ça que les boutons se bloquent quand tu es saturé.",
  'src.absorb.ref1': 'Jéquier & Constant 2010 — Clairance rénale de l’eau libre',
  'src.diuresis.title': 'ALCOOL — LA DIURÈSE',
  'src.diuresis.what':
    "Chaque gramme d'éthanol fait éliminer environ 10 mL d'urine supplémentaires. HYDRA convertit le volume et le degré du verre en grammes d'éthanol, puis applique cette perte.",
  'src.diuresis.ref1': 'Eggleton 1942 — J. Physiol.',
  'src.abv.title': 'ALCOOL — LE DEGRÉ COMPTE PLUS QUE LE VOLUME',
  'src.abv.what':
    "À dose d'éthanol égale, une bière (5°) ne produit pas de diurèse mesurable alors qu'un vin (13,5°) ou un spiritueux en produit une. HYDRA applique donc un facteur de concentration : 0,3 en dessous de 8°, jusqu'à 1,0 à partir de 20°. Une bière légère pèse réellement moins lourd qu'un shot de grammes équivalents.",
  'src.abv.ref1': 'Polhuis et al. 2017 — Nutrients',
  'src.abv.ref2': 'Maughan et al. 2016 — Beverage Hydration Index',
  'src.sweat.title': 'SPORT — LA SUEUR',
  'src.sweat.what':
    "La sueur suit la chaleur métabolique produite, donc la masse corporelle × l'intensité de l'effort, puis elle est modulée par la température et l'humidité. HYDRA part de 1,43 mL par MET·kg·h — calibré pour qu'un homme de 70 kg à 8 METs en conditions tempérées perde ≈ 800 mL/h. L'écart hommes/femmes venant surtout de la masse, il ne reste qu'un facteur résiduel de 0,9.",
  'src.sweat.ref1': 'Cramer & Jay 2016 — Thermorégulation',
  'src.sweat.ref2': 'Baker 2017 — Sports Medicine',
  'src.coffee.title': 'CAFÉ — PAS DÉSHYDRATANT À DOSE MODÉRÉE',
  'src.coffee.what':
    "Contrairement à l'idée reçue, un café normal compte comme de l'eau : aucune déshydratation mesurable à consommation modérée. HYDRA ne retire de l'eau qu'au-delà de 500 mg de caféine.",
  'src.coffee.ref1': 'Killer et al. 2014 — PLoS ONE',
} as const;

export type StringKey = keyof typeof fr;

// `Record<StringKey, string>` : le compilateur refuse un `en` incomplet. C'est
// le point entier de ce fichier.
export const en: Record<StringKey, string> = {
  // ── Tabs ──────────────────────────────────────────────────────────────────
  'tab.bar': 'BAR',
  'tab.data': 'DATA',
  'tab.widgets': 'WIDGETS',

  // ── Common ────────────────────────────────────────────────────────────────
  'common.next': 'NEXT',
  'common.back': 'BACK',
  'common.backArrow': '← Back',
  'common.start': 'START',
  'common.letsGo': "LET'S GO",
  'common.cancel': 'Cancel',
  'common.continue': 'Continue',
  'common.delete': 'Delete',
  'common.error': 'Error',
  'common.gotIt': 'GOT IT',
  'common.gotItLong': 'GOT IT',
  'common.close': 'CLOSE',
  'common.custom': 'CUSTOM',
  'common.male': 'MALE',
  'common.female': 'FEMALE',
  'common.maleShort': 'M',
  'common.femaleShort': 'F',
  'common.perDay': 'day',
  'common.details': 'Details: {label}',
  'splash.loadingProfile': 'Fetching your profile…',
  'bar.saturated': '  ·  SATURATED',
  'home.alcoholLightSub': '2–8%',
  'home.alcoholMediumSub': '9–22%',
  'widget.water': '＋ WATER',
  'widget.alcohol': 'ALCOHOL',
  'widget.btnLight': 'LIGHT 2–8%',
  'widget.btnMedium': 'MEDIUM 9–22%',
  'widget.btnStrong': 'STRONG 30–45%',

  // ── Zones ─────────────────────────────────────────────────────────────────
  'zone.green': 'HYDRATED',
  'zone.amber': 'DRYING OUT',
  'zone.red': 'CRITICAL',
  'zone.poison': 'POISONED',

  // ── Onboarding: step titles ───────────────────────────────────────────────
  'onb.step.language': 'LANGUAGE',
  'onb.step.welcome': 'WELCOME',
  'onb.step.you': 'YOU',
  'onb.step.rhythm': 'YOUR RHYTHM',
  'onb.step.environment': 'ENVIRONMENT',
  'onb.step.water': 'YOUR WATER',
  'onb.step.state': 'STATE',
  'onb.step.recap': 'RECAP',
  'onb.kicker': 'STEP {n}/{total}',

  // ── Onboarding: language ──────────────────────────────────────────────────
  'onb.language.help':
    'Pick your language. You can change it any time in WIDGETS → LANGUAGE.',

  // ── Onboarding: welcome ───────────────────────────────────────────────────
  'onb.welcome.tagline': 'Your hydration life bar, in real time.',
  'onb.welcome.body':
    'HYDRA works out your hydration from your physiology: your weight, your effort, the heat, alcohol… For the bar to match YOUR reality, we need a few things.',
  'onb.welcome.duration':
    'Takes 30 seconds. Everything stays editable later in WIDGETS → PROFILE.',
  'onb.welcome.haveAccount': 'Already have an account? Sign in',
  'onb.welcome.signedInNote':
    "You're signed in, but this account has no HYDRA profile yet. Complete the questionnaire, or switch accounts.",
  'onb.welcome.otherAccount': 'Use another account',

  // ── Onboarding: you ───────────────────────────────────────────────────────
  'onb.you.help':
    'Weight and sex drive your daily need and how much you sweat during effort.',
  'onb.you.sex': 'SEX',
  'onb.you.weight': 'WEIGHT',
  'onb.you.needPreview': 'ESTIMATED DAILY NEED · {ml} mL',

  // ── Onboarding: rhythm ────────────────────────────────────────────────────
  'onb.rhythm.help':
    'Set your sleep hours. Your waking hours are worked out from them — the bar slows down at night.',
  'onb.rhythm.bedtime': 'BEDTIME',
  'onb.rhythm.wakeup': 'WAKE-UP',
  'onb.rhythm.preview': '≈ {awake}h AWAKE · {sleep}h ASLEEP',

  // ── Onboarding: environment ───────────────────────────────────────────────
  'onb.env.help':
    'Heat and humidity increase sweat. Optional — you can skip and set it later.',
  'onb.env.switch': 'SET MY ENVIRONMENT',
  'onb.env.temp': 'AMBIENT TEMPERATURE',
  'onb.env.humidity': 'RELATIVE HUMIDITY',
  'onb.env.altitude': 'ALTITUDE',

  // ── Onboarding: water ─────────────────────────────────────────────────────
  'onb.water.help':
    'Your usual container: one tap in the widget = that much water logged.',
  'onb.water.customLabel': 'CUSTOM VOLUME',
  'onb.water.placeholder': 'e.g. 400',
  'onb.water.range': 'Between {min} and {max} mL.',

  // ── Onboarding: state ─────────────────────────────────────────────────────
  'onb.state.help':
    "We don't know you yet. Tell us how you feel right now — that's where the bar starts, not at 100%.",
  'onb.feeling.good': 'GOOD',
  'onb.feeling.good.hint': 'Hydrated, on form',
  'onb.feeling.ok': 'SO-SO',
  'onb.feeling.ok.hint': 'A bit tired / thirsty',
  'onb.feeling.dry': 'PARCHED',
  'onb.feeling.dry.hint': 'Thirsty, heavy head',

  // ── Onboarding: recap ─────────────────────────────────────────────────────
  'onb.recap.help': "Everything's ready. Check it and go.",
  'onb.recap.sex': 'Sex',
  'onb.recap.weight': 'Weight',
  'onb.recap.need': 'Need / day',
  'onb.recap.sleep': 'Sleep',
  'onb.recap.awake': 'Awake / day',
  'onb.recap.environment': 'Environment',
  'onb.recap.container': 'Water container',
  'onb.recap.startState': 'Starting state',
  'onb.recap.defaults': 'Default',
  'onb.recap.male': 'Male',
  'onb.recap.female': 'Female',

  // ── Onboarding: preparing ─────────────────────────────────────────────────
  'onb.prep.1': 'Working out your daily need from your weight…',
  'onb.prep.2': 'Adjusting for your sleep window…',
  'onb.prep.3': 'Factoring in your ambient temperature and humidity…',
  'onb.prep.4': 'Spreading your water intake across the day…',
  'onb.prep.5': 'Aligning your life bar with your sleep rhythm…',
  'onb.prep.6': 'Setting your hourly absorption ceiling…',
  'onb.prep.7': "Configuring alcohol's impact on your bar…",
  'onb.prep.8': 'Calibrating your per-glass reminders…',
  'onb.prep.9': 'Your profile is ready.',
  'onb.prep.goal': 'ESTIMATED TARGET · {ml} mL / DAY',

  // ── Home ──────────────────────────────────────────────────────────────────
  'home.streak': '🌊 WAVE {n}D',
  'home.streakEmpty': '🌊 START YOUR WAVE',
  'home.streakA11y': 'Details about your wave',
  'home.logoA11y': 'HYDRA logo',
  'home.redIn': 'RED IN',
  'home.saturated': "SATURATED · your body can't absorb any faster.",
  'home.saturatedWait': 'Wait {timer} more before drinking again.',
  'home.water': 'WATER',
  'home.alcoholLight': 'LIGHT ALCOHOL',
  'home.alcoholMedium': 'MEDIUM ALCOHOL',
  'home.alcoholStrong': 'STRONG ALCOHOL',
  'home.alcoholStrongSub': '30–45%  spirits',
  'home.sport': 'SPORT',
  'home.sportRunning': 'session running',
  'home.sportIdle': 'moderate or intense · duration',
  'home.undo': 'UNDO LAST ENTRY',
  'home.undoSub': 'removes water, alcohol or sport',
  'home.sessionBlocked': 'SESSION RUNNING · ends in {time}',
  'home.sessionStarted': 'SESSION STARTED · {min} min · sweating now',
  'home.footHint':
    'Daily need: {need} mL ({kg} kg × 32) · absorbed this hour {used}/{cap} mL',

  // ── Sport ─────────────────────────────────────────────────────────────────
  'sport.title': 'SPORT',
  'sport.intensity': 'INTENSITY',
  'sport.duration': 'DURATION',
  'sport.moderate': 'MODERATE',
  'sport.intense': 'INTENSE',
  'sport.light': 'LIGHT',
  'sport.hint':
    'The session starts now — the bar drops faster for the duration you pick.',
  'sport.confirm': 'START THE SESSION',
  'sport.active': 'SESSION RUNNING',
  'sport.sweatLine': '−{ml} mL/h sweat · {time} left',

  // ── Data ──────────────────────────────────────────────────────────────────
  'data.title': 'DATA',
  'data.drunkToday': 'DRUNK TODAY',
  'data.glasses': 'GLASSES',
  'data.greenTime': 'TIME IN THE GREEN',
  'data.wave': 'THE WAVE 🌊',
  'data.sinceStart': 'ALL TIME',
  'data.waterTotal': 'TOTAL WATER DRUNK',
  'data.alcoholTotal': 'TOTAL ALCOHOL UNITS',
  'data.sinceLine': 'Your all-time counter since {date} — it only goes up.',
  'data.sinceEmpty': 'Your all-time counter starts with your first glass.',
  'data.last7': 'LAST 7 DAYS',
  'data.goalHint': 'Target {ml} mL/day · full bar = target reached',
  'data.poisoning': 'POISONING',
  'data.purpleWeek': 'IN PURPLE (7 DAYS)',
  'data.alcoholFreeDays': 'ALCOHOL-FREE DAYS',
  'data.poisonHint': 'Goal: as little time in purple as possible.',
  'data.last30': 'LAST 30 DAYS',
  'data.waterDrunk': 'WATER DRUNK',
  'data.alcoholGlasses': 'ALCOHOL UNITS',
  'data.poisonedTime': 'TIME POISONED',
  'data.cleanDays': 'CLEAN DAYS',
  'data.day': 'TODAY',
  'data.empty': 'Nothing logged today.',
  'data.evt.water': 'WATER  {ml}ml',
  'data.evt.electrolytes': 'ELECTROLYTES  {ml}ml',
  'data.evt.alcohol': 'ALCOHOL  {ml}ml / {abv}%',
  'data.evt.caffeine': 'CAFFEINE  {ml}ml',
  'data.evt.sport': 'SPORT {intensity}  {min}min',
  'data.evt.profile': 'PROFILE changed',
  'data.durationMin': '{m} min',
  'data.durationHm': '{h} h {m}',
  'data.weekdayLetters': 'S,M,T,W,T,F,S',

  // ── The wave (help) ───────────────────────────────────────────────────────
  'wave.title': 'THE WAVE 🌊',
  'wave.body':
    "Your wave is the number of days in a row you drank enough water to hit your daily target (around {ml} mL, based on your weight).\n\nEvery day you hit it, your wave grows. If you haven't hit today's target yet, the previous days are kept — but the wave drops to zero the moment a past day comes up short.\n\nKeep your wave alive: drink every day.",

  // ── Widgets ───────────────────────────────────────────────────────────────
  'widgets.title': 'WIDGETS',
  'widgets.subtitle':
    'The widget is the product. This screen is its cockpit: preview, install, and the settings that feed it.',
  'widgets.preview': 'PREVIEW',
  'widgets.format.lock': 'LOCK SCREEN',
  'widgets.format.small': 'SQUARE 2×2',
  'widgets.format.medium': 'BANNER 4×2',
  'widgets.state.live': 'LIVE',
  'widgets.add': 'ADD THE WIDGET',
  'widgets.addLock': 'ADD TO THE LOCK SCREEN',
  'widgets.addHome': 'ADD TO THE HOME SCREEN',
  'widgets.refresh': 'REFRESH THE WIDGET',
  'widgets.refreshed': 'Widget refreshed.',
  'widgets.settings': 'WIDGET SETTINGS',
  'widgets.alcoholButtons': 'ALCOHOL BUTTONS (BANNER)',
  'widgets.defaultContainer': 'DEFAULT WATER CONTAINER',
  'widgets.customShort': 'CUSTOM {ml} mL',
  'widgets.profile': 'PROFILE (FEEDS THE WIDGET)',
  'widgets.weight': 'WEIGHT (kg)',
  'widgets.sex': 'SEX',
  'widgets.sleepStart': 'SLEEP START',
  'widgets.sleepEnd': 'SLEEP END',
  'widgets.awakeAuto': 'WAKING HOURS (AUTO)',
  'widgets.temp': 'AMBIENT TEMP °C',
  'widgets.humidity': 'HUMIDITY %',
  'widgets.altitude': 'ALTITUDE (m)',
  'widgets.goal': 'TARGET',
  'widgets.goalValue': '{ml} mL / day ({kg} × 32)',
  'widgets.hours': '{h} h',
  'widgets.restart': 'REDO THE QUESTIONNAIRE',
  'widgets.restartTitle': 'Redo the questionnaire',
  'widgets.restartBody':
    'You will go through the guided setup again (weight, sex, sleep, environment, container). Your current data stays saved.',
  'widgets.notifications': 'NOTIFICATIONS',
  'widgets.glassReminders': 'PER-GLASS REMINDERS',
  'widgets.remindersHint':
    'One reminder scheduled for every glass still needed today, spread out until your bedtime ({h}:00). Amber and red zone alerts stay on regardless.',
  'widgets.language': 'LANGUAGE',
  'widgets.languageHint':
    'Changes the language of the app and its notifications. The widget follows on its next refresh.',
  'widgets.account': 'ACCOUNT',
  'widgets.signedIn': 'SIGNED IN',
  'widgets.signOut': 'SIGN OUT',
  'widgets.deleteAccount': 'DELETE ACCOUNT',
  'widgets.deleteTitle': 'Delete account',
  'widgets.deleteBody':
    'All your data (profile, history) will be permanently erased. This cannot be undone.',
  'widgets.science': 'SCIENCE',
  'widgets.sources': 'SCIENTIFIC SOURCES',
  'widgets.disclaimer':
    'A consumer app for informational and entertainment purposes. It is not a medical device. The coefficients are population averages. Talk to a health professional about any specific hydration needs.',

  // ── Widget add guide ──────────────────────────────────────────────────────
  'guide.lock.title': 'ADD TO THE LOCK SCREEN',
  'guide.lock.1': 'Lock your iPhone, then press and hold the lock screen.',
  'guide.lock.2': 'Tap "Customise", then "Lock Screen".',
  'guide.lock.3': 'Tap the area under the clock, then "+ Add Widgets".',
  'guide.lock.4': 'Find "HYDRA" in the list and select it.',
  'guide.lock.5': 'Tap "Done": the life bar appears under the clock.',
  'guide.home.title': 'ADD TO THE HOME SCREEN',
  'guide.home.1': 'Press and hold an empty area of the home screen.',
  'guide.home.2': 'Tap the "+" in the top left.',
  'guide.home.3': 'Find "HYDRA" in the widget list.',
  'guide.home.4': 'Pick the size (square 2×2 or banner 4×2).',
  'guide.home.5': 'Tap "Add Widget", then "Done".',
  'guide.note':
    'iOS does not allow an app to add a widget for you — these steps are a one-off, done by hand. After that HYDRA updates itself.',

  // ── Paywall ───────────────────────────────────────────────────────────────
  'pay.tagline': 'Spend as little time as possible running dry.',
  'pay.prop1.title': 'Your life bar',
  'pay.prop1.desc': 'A bar that drains in real time. Drink to fill it back up.',
  'pay.prop2.title': 'Alcohol is a poison',
  'pay.prop2.desc':
    'Every drink speeds up your dehydration. See the real impact.',
  'pay.prop3.title': 'Lock screen widget',
  'pay.prop3.desc':
    'Your hydration permanently in view, without ever opening the app.',
  'pay.prop4.title': 'Physiological engine',
  'pay.prop4.desc':
    'Maths based on your body and real science, not points pulled from thin air.',
  'pay.perPeriod': '{price}/{period}',
  'pay.thenPerPeriod': 'then {price}/{period} · cancel any time',
  'pay.plainPeriod': '{price}/{period} · cancel any time',
  'pay.planMonthly': 'MONTHLY',
  'pay.planAnnual': 'ANNUAL',
  'pay.periodMonthShort': 'MONTH',
  'pay.periodMonth': 'month',
  'pay.periodYearShort': 'YEAR',
  'pay.periodYear': 'year',
  'pay.accountNote':
    'Your account is created. All that is left is starting your trial to unlock the app.',
  'pay.access':
    'HYDRA is a subscription app: full access (real-time bar, widgets, history) requires the HYDRA Pro subscription.',
  'pay.ctaTrial': 'START THE FREE TRIAL',
  'pay.ctaSubscribe': 'SUBSCRIBE',
  'pay.restore': 'Restore my purchases',
  'pay.signIn': 'Already have an account? Sign in',
  'pay.legalTrial':
    'Free trial of {trial}. Unless cancelled at least 24 h before it ends, the subscription renews automatically at {price}/{period}. ',
  'pay.legalPlain':
    'Subscription at {price}/{period}, renewing automatically unless cancelled at least 24 h before the end of the period. ',
  'pay.legalManage':
    'Manage or cancel the subscription in your Apple account settings.',
  'pay.terms': 'Terms',
  'pay.privacy': 'Privacy',
  'pay.sourcesLink': 'Sources',
  'pay.signOut': 'Sign out',
  'pay.noOffer': 'Offer unavailable right now. Try again in a moment.',
  'pay.trialDays': '{n} FREE DAY{s}',
  'pay.trialWeeks': '{n} FREE DAYS',
  'pay.trialMonths': '{n} FREE MONTH{s}',
  'pay.trialYears': '{n} FREE YEAR{s}',

  // ── Purchase: StoreKit messages ───────────────────────────────────────────
  'purchase.unavailable': 'Purchases are unavailable here.',
  'purchase.restoreUnavailable': 'Restoring is unavailable here.',
  'purchase.pending':
    'Purchase awaiting approval (your bank, or "Ask to Buy"). Nothing to redo: HYDRA unlocks as soon as it clears.',
  'purchase.alreadyOwned':
    'You already have this subscription. Use "Restore my purchases" just below.',
  'purchase.network': 'Connection lost. Check your network and try again.',
  'purchase.storeProblem':
    'The App Store is not responding right now. Try again in a moment.',
  'purchase.notAllowed':
    'Purchases are blocked on this device (Screen Time restrictions).',
  'purchase.productUnavailable':
    'This offer is not available on your App Store account.',
  'purchase.failed': 'The purchase did not go through. Try again in a moment.',
  'purchase.noEntitlement': 'No active subscription on this Apple account.',

  // ── Account ───────────────────────────────────────────────────────────────
  'auth.taglineSignIn':
    'Sign back in to get your progress and your subscription back.',
  'auth.taglineSignUp':
    'Last step: create your account to save your progress and find your bar on all your devices.',
  'auth.signIn': 'SIGN IN',
  'auth.signUp': 'CREATE ACCOUNT',
  'auth.or': 'OR',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.invalid': 'A valid email + a password of at least 6 characters.',
  'auth.created':
    'Account created. Check your inbox if a confirmation is required.',
  'auth.noSignUpHere':
    'No account yet? Go back: your account is created once the trial has started.',
  'auth.toSignUp': 'No account yet? Pick CREATE ACCOUNT at the top.',
  'auth.toSignIn': 'Already have an account? Pick SIGN IN at the top.',

  // ── Notifications ─────────────────────────────────────────────────────────
  'notif.nextGlass.title': 'NEXT GLASS.',
  'notif.nextGlass.many': '{n} more glasses to hit today’s target.',
  'notif.nextGlass.last': 'Last glass to hit today’s target.',
  'notif.amber.title': 'YOU’RE DRYING OUT.',
  'notif.amber.body': 'The bar has crossed into amber. Drink now.',
  'notif.red.title': 'CRITICAL.',
  'notif.red.body': 'HYDRA has gone red. Glass. Right now.',

  // ── Scientific sources ────────────────────────────────────────────────────
  'src.title': 'SCIENTIFIC SOURCES',
  'src.intro':
    'HYDRA is not a medical device and makes no diagnosis. The bar is an estimate computed from published coefficients, which are population averages: your body may differ. For any specific hydration need — pregnancy, kidney or heart disease, diuretic treatment, supervised endurance sport — talk to a health professional.',
  'src.note':
    'The links open the original publication (DOI). The formulas are also documented in full in the calculation engine’s source code.',
  'src.need.title': 'DAILY NEED — 32 mL/kg',
  'src.need.what':
    'HYDRA sets your water target at 32 mL per kilo of body weight, the midpoint of the 30–35 mL/kg clinical range, consistent with European reference intakes once the water in food is accounted for.',
  'src.need.ref1': 'EFSA 2010 — Dietary reference values for water',
  'src.need.ref2': 'Jéquier & Constant 2010 — Physiological basis',
  'src.absorb.title': 'ABSORPTION CEILING — ~1 L PER HOUR',
  'src.absorb.what':
    'Drinking a litre in one go does not hydrate you faster than sipping: beyond roughly 1 L per rolling hour, the excess is excreted. So HYDRA only credits the bar up to that ceiling — which is also why the buttons lock when you are saturated.',
  'src.absorb.ref1': 'Jéquier & Constant 2010 — Renal free-water clearance',
  'src.diuresis.title': 'ALCOHOL — DIURESIS',
  'src.diuresis.what':
    'Every gram of ethanol makes you pass roughly 10 mL of extra urine. HYDRA converts the volume and strength of the drink into grams of ethanol, then applies that loss.',
  'src.diuresis.ref1': 'Eggleton 1942 — J. Physiol.',
  'src.abv.title': 'ALCOHOL — STRENGTH MATTERS MORE THAN VOLUME',
  'src.abv.what':
    'At an equal ethanol dose, a beer (5%) produces no measurable diuresis while a wine (13.5%) or a spirit does. So HYDRA applies a concentration factor: 0.3 below 8%, up to 1.0 from 20%. A light beer really does weigh less than a shot of equivalent grams.',
  'src.abv.ref1': 'Polhuis et al. 2017 — Nutrients',
  'src.abv.ref2': 'Maughan et al. 2016 — Beverage Hydration Index',
  'src.sweat.title': 'SPORT — SWEAT',
  'src.sweat.what':
    'Sweat follows the metabolic heat produced, so body mass × effort intensity, then it is modulated by temperature and humidity. HYDRA starts from 1.43 mL per MET·kg·h — calibrated so that a 70 kg man at 8 METs in temperate conditions loses ≈ 800 mL/h. Since the male/female gap comes mostly from mass, only a residual factor of 0.9 remains.',
  'src.sweat.ref1': 'Cramer & Jay 2016 — Thermoregulation',
  'src.sweat.ref2': 'Baker 2017 — Sports Medicine',
  'src.coffee.title': 'COFFEE — NOT DEHYDRATING IN MODERATION',
  'src.coffee.what':
    'Contrary to the received wisdom, an ordinary coffee counts as water: no measurable dehydration at moderate intake. HYDRA only takes water away beyond 500 mg of caffeine.',
  'src.coffee.ref1': 'Killer et al. 2014 — PLoS ONE',
};

export const DICTIONARIES = { fr, en } as const;
