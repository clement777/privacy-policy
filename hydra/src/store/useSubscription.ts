import { create } from 'zustand';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { t } from '../i18n';
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';

// The entitlement identifier configured in RevenueCat. The whole app is gated
// behind it (paid model, 7-day trial then €3.99/mo). RevenueCat entitlement
// identifiers are immutable after creation — this must match the "Identifier"
// field shown on the entitlement's page exactly (case + spacing), NOT the
// (editable) Display Name.
export const ENTITLEMENT_ID = 'HYDRA Pro';

// react-native-purchases is a NATIVE module: absent in Expo Go / web. Load it
// defensively so those environments (and any build before RevenueCat is set up)
// don't crash — they just bypass the paywall.
let Purchases: typeof import('react-native-purchases').default | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Purchases = require('react-native-purchases').default;
} catch {
  Purchases = null;
}

const extra = (Constants.expoConfig?.extra ?? {}) as {
  revenueCatIosKey?: string;
  revenueCatAndroidKey?: string;
};
const apiKey =
  Platform.OS === 'ios'
    ? extra.revenueCatIosKey ?? ''
    : Platform.OS === 'android'
    ? extra.revenueCatAndroidKey ?? ''
    : '';

// Paywall runs only when the native module is present AND a key is configured.
export const paywallEnabled = (): boolean => !!Purchases && apiKey.length > 0;

export type SubStatus = 'loading' | 'active' | 'inactive';

/** Ce que StoreKit a réellement répondu. Quatre issues très différentes, qu'on
 *  confondait jusqu'ici en un seul « échec ». */
export type PurchaseOutcome = 'ok' | 'cancelled' | 'pending' | 'error';

export interface PurchaseResult {
  ok: boolean;
  outcome: PurchaseOutcome;
  /** Code RevenueCat brut, pour la mesure uniquement. */
  code: string;
  /** Message destiné à l'utilisateur, en français. Vide = ne rien afficher. */
  message: string;
}

// Codes de PURCHASES_ERROR_CODE, recopiés plutôt qu'importés : l'enum est une
// valeur, donc un import réel du module natif — or tout ce fichier est écrit
// pour survivre à son absence (Expo Go, web).
const RC_CANCELLED = '1';
const RC_STORE_PROBLEM = '2';
const RC_NOT_ALLOWED = '3';
const RC_PRODUCT_UNAVAILABLE = '5';
const RC_ALREADY_PURCHASED = '6';
const RC_NETWORK = '10';
const RC_PAYMENT_PENDING = '20';
const RC_OFFLINE = '35';

// StoreKit et RevenueCat renvoient des libellés anglais écrits pour un
// développeur. Les afficher tels quels à quelqu'un qui vient de taper
// « COMMENCER L'ESSAI GRATUIT » lui apprend que quelque chose a cassé.
//
// Le cas qui a motivé cette table : « The payment is pending. The payment is
// deferred. » Ce n'est PAS un échec — l'achat attend une validation (3-D Secure
// de la banque, très courant en Europe, ou « Demander à acheter » sur un compte
// familial). Il peut aboutir plusieurs minutes plus tard, et le listener
// RevenueCat débloquera l'app tout seul. Le présenter comme une erreur rouge
// fait partir quelqu'un qui était en train d'acheter.
function describe(code: string): { outcome: PurchaseOutcome; message: string } {
  switch (code) {
    case RC_CANCELLED:
      // Volontaire : aucun message, ce serait reprocher un choix.
      return { outcome: 'cancelled', message: '' };
    case RC_PAYMENT_PENDING:
      return { outcome: 'pending', message: t('purchase.pending') };
    case RC_ALREADY_PURCHASED:
      return { outcome: 'error', message: t('purchase.alreadyOwned') };
    case RC_NETWORK:
    case RC_OFFLINE:
      return { outcome: 'error', message: t('purchase.network') };
    case RC_STORE_PROBLEM:
      return { outcome: 'error', message: t('purchase.storeProblem') };
    case RC_NOT_ALLOWED:
      return { outcome: 'error', message: t('purchase.notAllowed') };
    case RC_PRODUCT_UNAVAILABLE:
      return { outcome: 'error', message: t('purchase.productUnavailable') };
    default:
      // Le libellé anglais de StoreKit n'est volontairement PAS affiché : il
      // ne veut rien dire pour l'utilisateur. Il ne sert qu'à la mesure, où le
      // code numérique le remplace avantageusement.
      return { outcome: 'error', message: t('purchase.failed') };
  }
}

interface SubState {
  status: SubStatus;
  packages: PurchasesPackage[];
  offering: PurchasesOffering | null;
  configured: boolean;

  // appUserId omitted → configure RevenueCat with an anonymous ID (used during
  // the onboarding funnel, before the user creates an account). Passing an id
  // later links (logIn) the anonymous purchases to that account.
  init: (appUserId?: string) => Promise<void>;
  refresh: () => Promise<void>;
  loadOfferings: () => Promise<void>;
  purchase: (pkg: PurchasesPackage) => Promise<PurchaseResult>;
  restore: () => Promise<PurchaseResult>;
  // Back to an anonymous RevenueCat user (call on sign-out).
  logOut: () => Promise<void>;
}

function isActive(info: CustomerInfo): boolean {
  return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
}

export const useSubscription = create<SubState>((set, get) => ({
  status: 'loading',
  packages: [],
  offering: null,
  configured: false,

  async init(appUserId) {
    // No RevenueCat (Expo Go, or key not set yet) → don't block the app.
    if (!paywallEnabled() || !Purchases) {
      set({ status: 'active', configured: false });
      return;
    }
    try {
      if (!get().configured) {
        // With appUserID → identified; without → RevenueCat mints an anonymous
        // ID that later transfers to the account on logIn.
        Purchases.configure(
          appUserId ? { apiKey, appUserID: appUserId } : { apiKey }
        );
        set({ configured: true });
        Purchases.addCustomerInfoUpdateListener((info) => {
          set({ status: isActive(info) ? 'active' : 'inactive' });
        });
      } else if (appUserId) {
        // Already configured (anonymously, or a different account) and now we
        // have an account id → link it. Transfers the anonymous trial across.
        await Purchases.logIn(appUserId);
      }
      await get().refresh();
      await get().loadOfferings();
    } catch {
      // If RevenueCat init fails, fail OPEN (don't lock the user out).
      set({ status: 'active' });
    }
  },

  async refresh() {
    if (!Purchases || !get().configured) return;
    try {
      const info = await Purchases.getCustomerInfo();
      set({ status: isActive(info) ? 'active' : 'inactive' });
    } catch {
      /* keep previous status */
    }
  },

  async loadOfferings() {
    if (!Purchases || !get().configured) return;
    try {
      const offerings = await Purchases.getOfferings();
      const current = offerings.current;
      set({
        offering: current ?? null,
        packages: current?.availablePackages ?? [],
      });
    } catch {
      /* leave packages empty; paywall shows a fallback */
    }
  },

  async purchase(pkg) {
    if (!Purchases) {
      return {
        ok: false,
        outcome: 'error',
        code: '',
        message: t('purchase.unavailable'),
      };
    }
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      set({ status: isActive(customerInfo) ? 'active' : 'inactive' });
      return { ok: true, outcome: 'ok', code: '', message: '' };
    } catch (e: unknown) {
      const err = e as { code?: string; userCancelled?: boolean };
      // `userCancelled` est le drapeau documenté ; `code` ne le porte pas
      // toujours selon la plateforme.
      const code = err.userCancelled ? RC_CANCELLED : err.code ?? '';
      return { ok: false, code, ...describe(code) };
    }
  },

  async restore() {
    if (!Purchases) {
      return {
        ok: false,
        outcome: 'error',
        code: '',
        message: t('purchase.restoreUnavailable'),
      };
    }
    try {
      const info = await Purchases.restorePurchases();
      const active = isActive(info);
      set({ status: active ? 'active' : 'inactive' });
      return active
        ? { ok: true, outcome: 'ok', code: '', message: '' }
        : {
            ok: false,
            outcome: 'error',
            code: 'no_entitlement',
            message: t('purchase.noEntitlement'),
          };
    } catch (e: unknown) {
      const err = e as { code?: string };
      const code = err.code ?? '';
      return { ok: false, code, ...describe(code) };
    }
  },

  async logOut() {
    if (!Purchases || !get().configured) return;
    try {
      const info = await Purchases.logOut();
      set({ status: isActive(info) ? 'active' : 'inactive' });
    } catch {
      set({ status: 'inactive' });
    }
  },
}));
