import PostHog from 'posthog-react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Mesure du tunnel d'entrée.
//
// Le 11 août : 100 téléchargements → 7 essais gratuits → 2 abonnés payants.
// 93 personnes sur 100 disparaissent AVANT de démarrer l'essai. Le paywall
// étant dur, elles abandonnent forcément pendant le questionnaire, pendant
// l'écran de préparation, ou devant le prix — mais on ignore laquelle des
// trois, donc on ne sait pas quoi corriger.
//
// Ce module répond à cette question et rien d'autre. Le vocabulaire est
// volontairement court : une dizaine d'événements qui se lisent comme un
// entonnoir, pas une instrumentation exhaustive qu'on n'exploitera jamais.
//
// Deux règles :
//   1. la mesure ne doit JAMAIS casser l'app — tout est avalé ;
//   2. aucune donnée personnelle ne sort d'ici. Pas d'e-mail, pas de poids,
//      pas d'identifiant de compte. Des étapes et des compteurs.
// ─────────────────────────────────────────────────────────────────────────────

// Clé publique en écriture seule, prévue pour être embarquée côté client.
const POSTHOG_KEY = 'phc_kFUVebGAMN7axPdRMEELexUzUtTgTz6jaPdR2ycX9ikb';
const POSTHOG_HOST = 'https://eu.i.posthog.com';

let client: PostHog | null = null;

/**
 * À appeler une fois au démarrage. Idempotent, et silencieux en cas d'échec :
 * une app qui refuse de démarrer parce que l'analytics est indisponible serait
 * un très mauvais échange.
 */
export function initAnalytics(): void {
  if (client) return;
  try {
    client = new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST });
    // Le projet PostHog est partagé avec la landing et l'autre produit ;
    // ces deux propriétés rendent les données de l'app filtrables.
    client.register({ product: 'hydra', surface: 'app' }).catch(() => {});
  } catch {
    client = null;
  }
}

/** Ce qu'on s'autorise à joindre à un événement : des scalaires, rien d'autre.
 *  Le typage interdit d'y glisser un objet — et donc d'exfiltrer un profil
 *  entier par inadvertance. */
type Prop = string | number | boolean | null | undefined;

/**
 * Envoie un événement. Ne lève jamais, ne bloque jamais l'appelant.
 */
export function track(event: string, props?: Record<string, Prop>): void {
  try {
    if (!client) return;
    // PostHog n'accepte pas `undefined` dans les propriétés, et les appelants
    // en produisent naturellement (`reason: ok ? undefined : message`). On les
    // retire ici plutôt que d'imposer la contrainte à chaque site d'appel.
    let clean: Record<string, string | number | boolean | null> | undefined;
    if (props) {
      clean = {};
      for (const [k, v] of Object.entries(props)) {
        if (v !== undefined) clean[k] = v;
      }
    }
    client.capture(event, clean);
  } catch {
    /* la mesure n'est jamais une raison d'interrompre l'utilisateur */
  }
}

/**
 * Vide la file d'attente. Utile avant un passage en arrière-plan, où iOS peut
 * suspendre le processus avant l'envoi périodique.
 */
export function flushAnalytics(): void {
  try {
    client?.flush().catch(() => {});
  } catch {
    /* idem */
  }
}

// ── Vocabulaire du tunnel ───────────────────────────────────────────────────
// Noms alignés sur ceux de la landing (`cta_appstore_click`) pour que les deux
// surfaces se lisent dans le même projet.
export const EV = {
  /** L'app s'ouvre sur le questionnaire : dénominateur du tunnel. */
  onboardingStarted: 'onboarding_started',
  /** Une étape du questionnaire s'affiche. `index` dit laquelle fait fuir. */
  onboardingStep: 'onboarding_step',
  /** Écran « on prépare ton plan » : 7,6 s d'attente, suspect n°1. */
  onboardingPreparing: 'onboarding_preparing',
  /** Questionnaire terminé et profil enregistré. */
  onboardingCompleted: 'onboarding_completed',

  /** Le paywall s'affiche. */
  paywallViewed: 'paywall_viewed',
  /** Offre RevenueCat résolue — ou pas : `has_package: false` = prix absent. */
  paywallOfferLoaded: 'paywall_offer_loaded',
  /** L'utilisateur demande l'essai : c'est l'intention d'achat. */
  paywallStartTapped: 'paywall_start_tapped',
  /** L'achat aboutit. */
  paywallPurchaseOk: 'paywall_purchase_ok',
  /** L'achat échoue — carte refusée, StoreKit indisponible, annulation. */
  paywallPurchaseFailed: 'paywall_purchase_failed',
  /** « Restaurer mes achats ». */
  paywallRestoreTapped: 'paywall_restore_tapped',

  /** Écran de compte — dernière marche du premier lancement, essai déjà démarré. */
  accountScreenViewed: 'account_screen_viewed',

  /** Le guide d'installation du widget s'ouvre au premier lancement. */
  widgetGuideOpened: 'widget_guide_opened',
} as const;
