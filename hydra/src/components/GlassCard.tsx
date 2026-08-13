import React from 'react';
import { BlurView } from 'expo-blur';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { GLASS, GLASS_SHADOW } from '../theme/glass';

// Surface translucide pour regrouper du contenu — la carte du paywall posée
// au-dessus de l'accueil, un bloc de réglages, un encart d'information.
//
// Même recette que GlassButton : flou, remplissage très léger, bordure fine, et
// surtout le liseré supérieur qui donne l'épaisseur. `elevated` ajoute une ombre
// portée, à réserver aux surfaces réellement au-dessus d'autre chose — sinon on
// obtient une pile de cartes qui flottent toutes et plus rien ne ressort.
export function GlassCard({
  children,
  style,
  intensity = GLASS.blur,
  strong = false,
  elevated = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  /** Remplissage plus marqué, quand la lisibilité prime sur la transparence. */
  strong?: boolean;
  elevated?: boolean;
}) {
  return (
    <View style={[styles.clip, elevated && GLASS_SHADOW, style]}>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
      <View
        style={[
          styles.surface,
          { backgroundColor: strong ? GLASS.fillStrong : GLASS.fill },
        ]}
      >
        {children}
      </View>
      <View style={styles.topEdge} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    borderRadius: GLASS.radiusLg,
    overflow: 'hidden',
  },
  surface: {
    borderRadius: GLASS.radiusLg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS.border,
    padding: 20,
  },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: GLASS.radiusLg * 0.6,
    right: GLASS.radiusLg * 0.6,
    height: StyleSheet.hairlineWidth,
    backgroundColor: GLASS.topEdge,
  },
});
