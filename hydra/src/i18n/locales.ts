import * as Localization from 'expo-localization';

// ─────────────────────────────────────────────────────────────────────────────
// Les langues que HYDRA parle.
//
// Une seule variante d'anglais, volontairement. Un `en-GB` et un `en-US`
// séparés doubleraient le dictionnaire pour une poignée de différences
// d'orthographe, et chaque chaîne ajoutée ensuite devrait être écrite deux
// fois — c'est exactement comme ça qu'une traduction se désynchronise. Les
// deux drapeaux sont affichés côte à côte pour que les deux publics se
// reconnaissent dans la même entrée.
//
// Ce qui sépare RÉELLEMENT le Royaume-Uni des États-Unis n'est pas la langue
// mais les UNITÉS (livres, onces liquides). C'est une fonctionnalité à part,
// pas une traduction : la voir passer pour un problème de langue conduirait à
// livrer un anglais américain qui parle quand même en kilos.
// ─────────────────────────────────────────────────────────────────────────────

export type Locale = 'fr' | 'en';

export interface LocaleOption {
  code: Locale;
  /** Drapeaux, dans l'ordre d'importance du marché. */
  flags: string;
  /** Nom de la langue DANS cette langue — on ne demande pas à un anglophone
   *  de reconnaître le mot « Anglais ». */
  label: string;
  /** Sous-titre : à qui elle s'adresse. */
  hint: string;
}

export const LOCALES: readonly LocaleOption[] = [
  { code: 'fr', flags: '🇫🇷', label: 'Français', hint: 'France · Belgique · Suisse' },
  { code: 'en', flags: '🇬🇧 🇺🇸', label: 'English', hint: 'United Kingdom · United States' },
] as const;

export const DEFAULT_LOCALE: Locale = 'fr';

export function isLocale(v: unknown): v is Locale {
  return v === 'fr' || v === 'en';
}

/**
 * La langue de l'appareil, si HYDRA la parle.
 *
 * Sert uniquement de valeur initiale : dès que quelqu'un choisit une langue au
 * premier écran du questionnaire, c'est son choix qui est persisté et cette
 * détection n'est plus consultée. Un anglophone qui préfère le français doit
 * pouvoir le garder après une réinstallation.
 */
export function deviceLocale(): Locale {
  try {
    for (const l of Localization.getLocales()) {
      const code = (l.languageCode ?? '').toLowerCase();
      if (isLocale(code)) return code;
    }
  } catch {
    /* environnement sans module natif (tests, web) : on retombe sur le défaut */
  }
  return DEFAULT_LOCALE;
}

/** Étiquette BCP-47 pour `toLocaleDateString` et consorts. */
export function bcp47(locale: Locale): string {
  return locale === 'en' ? 'en-GB' : 'fr-FR';
}
