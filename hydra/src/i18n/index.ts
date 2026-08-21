import { useCallback } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  bcp47,
  DEFAULT_LOCALE,
  deviceLocale,
  isLocale,
  Locale,
} from './locales';
import { DICTIONARIES, StringKey } from './strings';

export type { Locale, LocaleOption } from './locales';
export { LOCALES, bcp47 } from './locales';
export type { StringKey } from './strings';

export type Params = Record<string, string | number>;

// ─────────────────────────────────────────────────────────────────────────────
// Traduction.
//
// Deux points d'entrée, et la différence compte :
//
//   • `useT()` dans un composant — il S'ABONNE à la langue, donc changer de
//     langue re-rend l'écran immédiatement. C'est le cas normal.
//   • `t()` hors de React — planificateur de notifications, store d'abonnement.
//     Il lit l'état courant sans s'abonner, ce qu'un hook ne peut pas faire.
//
// Utiliser `t()` dans un composant compilerait sans erreur mais figerait le
// texte jusqu'au prochain rendu déclenché par autre chose. D'où les deux noms.
// ─────────────────────────────────────────────────────────────────────────────

/** Remplace `{clé}` par sa valeur. Un paramètre absent laisse le marqueur en
 *  place plutôt que d'écrire « undefined » à l'écran. */
function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in params ? String(params[key]) : whole
  );
}

export function translate(
  locale: Locale,
  key: StringKey,
  params?: Params
): string {
  // Repli sur le français si une clé manque à l'exécution. Le typage de
  // `strings.ts` rend le cas impossible à la compilation ; ce repli couvre
  // uniquement un dictionnaire livré par une mise à jour OTA plus récente que
  // le binaire — auquel cas afficher du français vaut mieux qu'une clé nue.
  const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
  const raw = dict[key] ?? DICTIONARIES[DEFAULT_LOCALE][key] ?? key;
  return interpolate(raw, params);
}

interface LocaleState {
  locale: Locale;
  /** Vrai dès que quelqu'un a choisi explicitement, au questionnaire ou dans
   *  les réglages. Distingue « français parce que c'est l'appareil » de
   *  « français parce que je l'ai demandé ». */
  chosen: boolean;
  setLocale: (l: Locale) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      // Valeur d'amorçage seulement : dès que le stockage est relu, c'est lui
      // qui gagne. Quelqu'un qui a choisi le français sur un iPhone anglais le
      // retrouve au relancement.
      locale: deviceLocale(),
      chosen: false,
      setLocale(l) {
        set({ locale: l, chosen: true });
      },
    }),
    {
      name: 'hydra-locale',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ locale: s.locale, chosen: s.chosen }),
      onRehydrateStorage: () => (state) => {
        // Un stockage corrompu, ou écrit par une version qui parlait une langue
        // qu'on ne livre plus, ne doit pas laisser l'app sans dictionnaire.
        //
        // Ce rappel ne sert QU'À ça : l'état « rehydratation terminée » se lit
        // via `persist.onFinishHydration`, qui se déclenche aussi quand la
        // lecture ÉCHOUE. S'appuyer sur un drapeau posé ici laisserait l'app
        // bloquée sur son écran de démarrage le jour où AsyncStorage renvoie
        // une erreur — un écran noir permanent pour éviter un clignotement.
        if (state && !isLocale(state.locale)) state.locale = deviceLocale();
      },
    }
  )
);

/** La langue courante, réactive. */
export function useLocale(): Locale {
  return useLocaleStore((s) => s.locale);
}

/** Traducteur réactif, à utiliser dans les composants. */
export function useT(): (key: StringKey, params?: Params) => string {
  const locale = useLocale();
  return useCallback(
    (key: StringKey, params?: Params) => translate(locale, key, params),
    [locale]
  );
}

/** Traducteur non réactif, pour le code hors composants. */
export function t(key: StringKey, params?: Params): string {
  return translate(useLocaleStore.getState().locale, key, params);
}

/** Langue courante hors composants. */
export function currentLocale(): Locale {
  return useLocaleStore.getState().locale;
}

/** Étiquette BCP-47 courante, pour `toLocaleDateString`. */
export function currentBcp47(): string {
  return bcp47(currentLocale());
}
