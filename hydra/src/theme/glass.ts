import { C } from './colors';

// ─────────────────────────────────────────────────────────────────────────────
// Matière translucide, façon iOS récent.
//
// Le vrai « Liquid Glass » d'Apple (expo-glass-effect) exige iOS 26 et Expo
// SDK 56 : hors de portée ici, et invisible pour une audience à 73 % de plus de
// 35 ans, qui ne met pas à jour iOS le jour de la sortie. On reproduit donc
// l'effet à la main, ce qui fonctionne depuis iOS 13.
//
// Ce qui fait l'illusion, dans l'ordre d'importance — et le flou n'est PAS
// premier :
//
//   1. le liseré supérieur clair : c'est lui qui donne l'épaisseur et la
//      matière. Sans lui, on a une surface plate teintée, pas du verre.
//   2. le remplissage translucide, très faible en alpha.
//   3. la bordure fine, plus sombre que le liseré.
//   4. le flou, utile UNIQUEMENT s'il y a du contenu derrière. Sur le fond noir
//      de HYDRA sans rien dessous, flouter du noir donne du noir — d'où des
//      composants qui restent lisibles même quand le flou n'apporte rien.
// ─────────────────────────────────────────────────────────────────────────────

export const GLASS = {
  /** Intensité de flou par défaut. Assez pour séparer les plans, assez peu
   *  pour laisser lire ce qu'il y a derrière — la barre, notamment. */
  blur: 28,

  /** Remplissage. Volontairement très faible : au-delà, on obtient du gris
   *  plastique et l'effet de matière disparaît. */
  fill: 'rgba(255,255,255,0.07)',
  fillStrong: 'rgba(255,255,255,0.12)',

  /** Bordure de contour. */
  border: 'rgba(255,255,255,0.14)',

  /** Liseré supérieur — l'élément le plus important du lot. Simule la lumière
   *  qui accroche l'arête haute d'une surface épaisse. */
  topEdge: 'rgba(255,255,255,0.30)',

  /** Teinte accentuée, pour un élément translucide qui doit rester vert. */
  accentFill: 'rgba(62,224,122,0.14)',
  accentBorder: 'rgba(62,224,122,0.38)',

  /** Rayon généreux : les formes serrées cassent l'impression de matière. */
  radius: 18,
  radiusLg: 24,
  radiusPill: 999,
} as const;

/** Ombre portée douce, pour décoller une surface de son fond. */
export const GLASS_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.35,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
} as const;

/** Couleur de texte selon la variante de surface. */
export const GLASS_TEXT = {
  onSolid: C.bg,
  onGlass: C.text,
  dim: C.textDim,
} as const;
