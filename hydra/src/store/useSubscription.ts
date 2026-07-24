import { create } from 'zustand';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
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
export type PurchaseResult = { ok: true } | { ok: false; message: string };

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
    if (!Purchases) return { ok: false, message: 'Achat indisponible ici.' };
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      set({ status: isActive(customerInfo) ? 'active' : 'inactive' });
      return { ok: true };
    } catch (e: unknown) {
      const err = e as { userCancelled?: boolean; message?: string };
      if (err.userCancelled) return { ok: false, message: '' }; // silent
      return { ok: false, message: err.message ?? 'Achat impossible.' };
    }
  },

  async restore() {
    if (!Purchases) return { ok: false, message: 'Restauration indisponible.' };
    try {
      const info = await Purchases.restorePurchases();
      const active = isActive(info);
      set({ status: active ? 'active' : 'inactive' });
      return active
        ? { ok: true }
        : { ok: false, message: 'Aucun abonnement actif trouvé.' };
    } catch (e: unknown) {
      const err = e as { message?: string };
      return { ok: false, message: err.message ?? 'Restauration impossible.' };
    }
  },
}));
