import React, { useRef } from 'react';
import { BlurView } from 'expo-blur';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { C, FONTS } from '../theme/colors';
import { GLASS, GLASS_SHADOW, GLASS_TEXT } from '../theme/glass';

// ─────────────────────────────────────────────────────────────────────────────
// Le bouton unique de l'app.
//
// Jusqu'ici chaque écran redéfinissait les siens — `cta` sur le paywall,
// `primaryBtn` dans l'onboarding, `primary` sur l'écran de compte, `chip` dans
// les réglages. Quatre grammaires visuelles pour la même action, et aucun moyen
// de dire d'un coup d'œil lequel est LE bouton d'une page.
//
// Trois variantes, et la contrainte est volontaire :
//
//   solid  — un seul par écran. C'est l'action principale, la seule pleine.
//   glass  — tout le reste. Translucide, présent, jamais concurrent.
//   ghost  — texte seul, pour le tertiaire (« Restaurer mes achats »).
//
// La recherche sur les paywalls qui convertissent dit la même chose : un seul
// appel à l'action dominant, le reste visuellement récessif. Avoir trois
// variantes plutôt qu'un style libre rend cette règle difficile à enfreindre
// par accident.
// ─────────────────────────────────────────────────────────────────────────────

export type GlassVariant = 'solid' | 'glass' | 'ghost';

interface Props {
  label: string;
  onPress: () => void;
  variant?: GlassVariant;
  /** Teinte d'accent. Par défaut le vert HYDRA ; passer C.red pour une action
   *  destructive, C.amber pour un avertissement. */
  tint?: string;
  disabled?: boolean;
  busy?: boolean;
  /** Occupe toute la largeur disponible. Vrai par défaut sur `solid`. */
  block?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function GlassButton({
  label,
  onPress,
  variant = 'glass',
  tint = C.segmentFull,
  disabled = false,
  busy = false,
  block,
  style,
}: Props) {
  // Léger enfoncement au toucher. C'est ce qui donne l'impression d'une
  // matière qui répond, plutôt que d'une image qui clignote.
  const scale = useRef(new Animated.Value(1)).current;
  const reduceMotion = useRef(false);

  React.useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => {
        if (alive) reduceMotion.current = r;
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const springTo = (v: number) => {
    if (reduceMotion.current) return;
    Animated.spring(scale, {
      toValue: v,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  };

  const isSolid = variant === 'solid';
  const fullWidth = block ?? isSolid;
  const inactive = disabled || busy;

  const handlePress = () => {
    if (inactive) return;
    Haptics.impactAsync(
      isSolid ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
    ).catch(() => {});
    onPress();
  };

  const content = busy ? (
    <ActivityIndicator color={isSolid ? C.bg : tint} />
  ) : (
    <Text
      style={[
        styles.label,
        isSolid && { color: GLASS_TEXT.onSolid },
        variant === 'glass' && { color: tint },
        variant === 'ghost' && styles.ghostLabel,
      ]}
      numberOfLines={1}
    >
      {label}
    </Text>
  );

  if (variant === 'ghost') {
    return (
      <Pressable
        onPress={handlePress}
        disabled={inactive}
        hitSlop={10}
        style={[fullWidth && styles.block, inactive && styles.inactive, style]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <Animated.View
      style={[
        { transform: [{ scale }] },
        fullWidth && styles.block,
        isSolid && GLASS_SHADOW,
        inactive && styles.inactive,
        style,
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={() => springTo(0.97)}
        onPressOut={() => springTo(1)}
        disabled={inactive}
        style={styles.press}
      >
        <View style={styles.clip}>
          {/* Le flou n'a d'effet que s'il y a du contenu derrière — sur un fond
              noir uni il ne coûte rien et ne rend rien. Il compte surtout quand
              le bouton passe au-dessus de la barre ou du paywall superposé. */}
          {!isSolid ? (
            <BlurView intensity={GLASS.blur} tint="dark" style={StyleSheet.absoluteFill} />
          ) : null}

          <View
            style={[
              styles.surface,
              isSolid
                ? { backgroundColor: tint }
                : { backgroundColor: GLASS.fill, borderColor: GLASS.border },
            ]}
          >
            {content}
          </View>

          {/* Liseré supérieur : l'élément qui fait toute la différence entre une
              surface plate et une matière épaisse. Une ligne de 1 px, plus
              claire que la bordure, sur l'arête haute uniquement. */}
          {!isSolid ? <View style={styles.topEdge} pointerEvents="none" /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: { alignSelf: 'stretch' },
  inactive: { opacity: 0.45 },
  press: { borderRadius: GLASS.radius },
  clip: {
    borderRadius: GLASS.radius,
    overflow: 'hidden',
  },
  surface: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: GLASS.radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: GLASS.radius * 0.6,
    right: GLASS.radius * 0.6,
    height: StyleSheet.hairlineWidth,
    backgroundColor: GLASS.topEdge,
  },
  label: {
    fontFamily: FONTS.display,
    fontSize: 15,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: C.text,
  },
  ghostLabel: {
    fontFamily: FONTS.mono,
    fontSize: 13,
    letterSpacing: 0.4,
    textTransform: 'none',
    color: C.textDim,
  },
});
