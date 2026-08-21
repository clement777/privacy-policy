import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { C, FONTS, RADIUS } from '../theme/colors';
import { t } from '../i18n';
import { displayLevelPct, HydrationState } from '../engine/hydrationEngine';

interface Props {
  state: HydrationState;
  segments?: number;
  height?: number;
  style?: ViewStyle;
  /** Pulsing border while a sport session window is active. */
  sportActive?: boolean;
}

export function HydrationBar({
  state,
  segments = 20,
  height = 44,
  style,
  sportActive = false,
}: Props) {
  const pct = displayLevelPct(state.levelPct);
  const filled = Math.round((pct / 100) * segments);
  const zoneColor =
    state.zone === 'poison'
      ? C.poison
      : state.zone === 'red'
      ? C.red
      : state.zone === 'amber'
      ? C.amber
      : C.segmentFull;
  return (
    <View style={[styles.wrap, style]}>
      <View
        style={[
          styles.bar,
          { height },
          sportActive && styles.barSportActive,
        ]}
      >
        {Array.from({ length: segments }).map((_, i) => {
          const on = i < filled;
          return (
            <View
              key={i}
              style={[
                styles.seg,
                {
                  backgroundColor: on ? zoneColor : C.segmentEmpty,
                  shadowColor: on ? zoneColor : 'transparent',
                },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.pct}>{pct}%</Text>
        <Text style={[styles.status, { color: zoneColor }]}>
          {statusLabel(state)}
        </Text>
      </View>
      <Text style={styles.ml}>
        {Math.round(state.levelMl)} / {Math.round(state.dailyNeedMl)} mL
        {state.poisoned ? `  ·  POISON ×${state.poisonMult.toFixed(2)}` : ''}
        {state.saturated ? t('bar.saturated') : ''}
      </Text>
    </View>
  );
}

function statusLabel(s: HydrationState): string {
  if (s.poisoned) return t('zone.poison');
  if (s.zone === 'red') return t('zone.red');
  if (s.zone === 'amber') return t('zone.amber');
  return t('zone.green');
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  bar: {
    flexDirection: 'row',
    gap: 3,
    padding: 4,
    borderRadius: RADIUS.md,
    backgroundColor: C.bgSoft,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  barSportActive: {
    borderColor: C.text,
    shadowColor: C.text,
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  seg: { flex: 1, borderRadius: 3, shadowOpacity: 0.7, shadowRadius: 4 },
  metaRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  pct: {
    color: C.text,
    fontSize: 40,
    fontFamily: FONTS.monoBold,
    letterSpacing: 2,
  },
  status: { fontSize: 18, fontFamily: FONTS.display, letterSpacing: 3 },
  ml: {
    marginTop: 4,
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 12,
    letterSpacing: 1,
  },
});
