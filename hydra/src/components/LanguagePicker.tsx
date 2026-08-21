import React from 'react';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { C, FONTS, RADIUS } from '../theme/colors';
import { LOCALES, useLocale, useLocaleStore } from '../i18n';

// Le drapeau porte l'information, pas le texte : c'est le seul élément de
// l'écran que quelqu'un qui ne comprend PAS la langue affichée peut lire. Le
// nom de la langue est écrit dans cette langue pour la même raison — on ne
// demande pas à un anglophone de reconnaître le mot « Anglais ».
export function LanguagePicker({ compact = false }: { compact?: boolean }) {
  const locale = useLocale();
  const setLocale = useLocaleStore((s) => s.setLocale);

  return (
    <View style={styles.list}>
      {LOCALES.map((opt) => {
        const on = locale === opt.code;
        return (
          <Pressable
            key={opt.code}
            style={[styles.card, on && styles.cardOn, compact && styles.cardCompact]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={opt.label}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setLocale(opt.code);
            }}
          >
            <Text style={[styles.flags, compact && styles.flagsCompact]}>
              {opt.flags}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, on && styles.labelOn]}>{opt.label}</Text>
              {compact ? null : <Text style={styles.hint}>{opt.hint}</Text>}
            </View>
            {/* Une pastille pleine plutôt qu'une coche : lisible sans lire. */}
            <View style={[styles.radio, on && styles.radioOn]}>
              {on ? <View style={styles.radioDot} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: C.bgSoft,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: C.segmentEmpty,
    paddingVertical: 18,
    paddingHorizontal: 18,
  },
  cardCompact: { paddingVertical: 12, paddingHorizontal: 14, gap: 12 },
  cardOn: { borderColor: C.segmentFull, backgroundColor: 'rgba(62,224,122,0.10)' },
  flags: { fontSize: 30 },
  flagsCompact: { fontSize: 22 },
  label: {
    color: C.text,
    fontFamily: FONTS.display,
    fontSize: 17,
    letterSpacing: 2,
  },
  labelOn: { color: C.segmentFull },
  hint: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 11,
    marginTop: 4,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: C.segmentEmpty,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: C.segmentFull },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: C.segmentFull,
  },
});
