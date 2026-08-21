import type { StringKey } from '../i18n';

type Translate = (key: StringKey, params?: Record<string, string | number>) => string;

// Le traducteur est passé en argument plutôt qu'importé : cette fonction est
// appelée depuis le rendu de deux écrans, et un `t()` non réactif y figerait
// le texte dans la langue affichée au premier montage.
export function vagueHint(goalMl: number, tr: Translate) {
  return {
    title: tr('wave.title'),
    body: tr('wave.body', { ml: Math.round(goalMl) }),
  };
}
