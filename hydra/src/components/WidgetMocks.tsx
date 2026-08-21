import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { C, FONTS, RADIUS } from '../theme/colors';
import { t } from '../i18n';
import { displayLevelPct, HydrationState } from '../engine/hydrationEngine';

// Faithful React-Native replicas of the native iOS widget (HydraWidget.swift)
// and the landing mockup (hydra-landing/index.html). Rendered on web/Expo Go so
// the widget design can be previewed and iterated on a PC — WidgetKit itself
// only runs on a real iPhone. Any visual change here is the reference to port
// 1:1 into targets/widget/HydraWidget.swift at build time (règle d'or).

const SEG = 14;

function zoneColor(state: HydrationState): string {
  switch (state.zone) {
    case 'poison':
      return C.poison;
    case 'red':
      return C.red;
    case 'amber':
      return C.amber;
    default:
      return C.segmentFull;
  }
}

// Ces maquettes reproduisent le widget natif, qui est écrit en Swift et lit sa
// langue dans le snapshot de l'App Group. `t()` non réactif convient donc :
// l'aperçu doit montrer ce que le VRAI widget affichera, pas devancer un
// changement de langue que le widget n'a pas encore repris.
function statusLabel(s: HydrationState): string {
  if (s.poisoned) return t('zone.poison');
  if (s.zone === 'red') return t('zone.red');
  if (s.zone === 'amber') return t('zone.amber');
  return t('zone.green');
}

function countdownLabel(s: HydrationState): string {
  if (s.redAt == null) return '—';
  const secs = s.redAt / 1000 - Date.now() / 1000;
  if (secs <= 0) return t('zone.red');
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  return h > 0 ? `→ ${h}h${String(m).padStart(2, '0')}` : `→ ${m}min`;
}

function Segments({
  state,
  mono,
  height = 11,
}: {
  state: HydrationState;
  mono?: boolean;
  height?: number;
}) {
  const zc = zoneColor(state);
  const pct = displayLevelPct(state.levelPct);
  const filled = Math.round((pct / 100) * SEG);
  return (
    <View style={styles.segRow}>
      {Array.from({ length: SEG }).map((_, i) => {
        const on = i < filled;
        const bg = on
          ? mono
            ? 'rgba(255,255,255,0.92)'
            : zc
          : mono
          ? 'rgba(255,255,255,0.22)'
          : C.segmentEmpty;
        return (
          <View
            key={i}
            style={[
              styles.seg,
              { height, backgroundColor: bg },
              on && !mono
                ? { shadowColor: zc, shadowOpacity: 0.5, shadowRadius: 4 }
                : null,
            ]}
          />
        );
      })}
    </View>
  );
}

function FakeButton({
  label,
  color,
  border,
  bg,
  style,
}: {
  label: string;
  color: string;
  border: string;
  bg: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.btn, { backgroundColor: bg, borderColor: border }, style]}>
      <Text style={[styles.btnText, { color }]}>{label}</Text>
    </View>
  );
}

function waterLabel(waterMl?: number): string {
  const base = t('widget.water');
  return waterMl ? `${base} · ${waterMl} mL` : base;
}

// ————————— Lock screen (accessoryRectangular, monochrome) —————————

export function LockWidget({
  state,
  waterMl,
}: {
  state: HydrationState;
  waterMl?: number;
}) {
  return (
    <View style={styles.lockShell}>
      <View style={styles.headRow}>
        <Text style={[styles.brand, { color: '#fff' }]}>HYDRA</Text>
        <Text style={[styles.lockPct, { color: '#fff' }]}>
          {displayLevelPct(state.levelPct)}%
        </Text>
      </View>
      <Segments state={state} mono height={10} />
      <View style={styles.footRow}>
        <Text style={[styles.status, { color: '#fff' }]}>{statusLabel(state)}</Text>
        <Text style={[styles.cd, { color: 'rgba(255,255,255,0.6)' }]}>
          {countdownLabel(state)}
        </Text>
      </View>
      <FakeButton
        label={waterLabel(waterMl)}
        color="#fff"
        border="rgba(255,255,255,0.35)"
        bg="rgba(255,255,255,0.16)"
        style={{ marginTop: 8 }}
      />
    </View>
  );
}

// ————————— Home small (systemSmall, couleur) —————————

export function SmallWidget({
  state,
  waterMl,
}: {
  state: HydrationState;
  waterMl?: number;
}) {
  const zc = zoneColor(state);
  return (
    <View style={styles.smallShell}>
      <View style={styles.headRow}>
        <Text style={styles.brand}>HYDRA</Text>
        <Text style={{ fontSize: 13 }}>💧</Text>
      </View>
      <Text style={[styles.bigPct, { color: zc }]}>{displayLevelPct(state.levelPct)}%</Text>
      <Segments state={state} />
      <View style={[styles.footRow, { marginTop: 'auto' }]}>
        <Text style={[styles.status, { color: zc }]}>{statusLabel(state)}</Text>
        <Text style={styles.cd}>{countdownLabel(state)}</Text>
      </View>
      <FakeButton
        label={waterLabel(waterMl)}
        color={C.segmentFull}
        border="rgba(62,224,122,0.4)"
        bg="rgba(62,224,122,0.15)"
        style={{ marginTop: 9 }}
      />
    </View>
  );
}

// ————————— Home medium (bandeau 4×2, couleur, + rangée alcool) —————————

export function MediumWidget({
  state,
  waterMl,
  showAlcohol = true,
}: {
  state: HydrationState;
  waterMl?: number;
  showAlcohol?: boolean;
}) {
  const zc = zoneColor(state);
  return (
    <View style={styles.mediumShell}>
      <View style={styles.mTopRow}>
        <View style={styles.mLeft}>
          <Text style={styles.brand}>HYDRA</Text>
          <Text style={[styles.mBig, { color: zc }]}>{displayLevelPct(state.levelPct)}%</Text>
          <Text style={[styles.status, { color: zc }]}>{statusLabel(state)}</Text>
        </View>
        <View style={styles.mMid}>
          <View style={styles.mTop}>
            <Text style={styles.need}>besoin {Math.round(state.dailyNeedMl)} mL</Text>
            <Text style={styles.cd}>{countdownLabel(state)}</Text>
          </View>
          <Segments state={state} />
        </View>
      </View>
      <FakeButton
        label={waterLabel(waterMl)}
        color={C.segmentFull}
        border="rgba(62,224,122,0.4)"
        bg="rgba(62,224,122,0.15)"
      />
      {showAlcohol ? (
        <View style={styles.alcBox}>
          <Text style={styles.alcLabel}>{t('widget.alcohol')}</Text>
          <View style={styles.alcBtns}>
            <FakeButton
              label={t('widget.btnLight')}
              color={C.amber}
              border="rgba(255,176,32,0.42)"
              bg="rgba(255,176,32,0.13)"
              style={styles.alcBtn}
            />
            <FakeButton
              label={t('widget.btnMedium')}
              color={C.amber}
              border="rgba(255,176,32,0.42)"
              bg="rgba(255,176,32,0.13)"
              style={styles.alcBtn}
            />
            <FakeButton
              label={t('widget.btnStrong')}
              color={C.red}
              border="rgba(255,59,74,0.42)"
              bg="rgba(255,59,74,0.13)"
              style={styles.alcBtn}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  segRow: { flexDirection: 'row', gap: 2.5 },
  seg: { flex: 1, borderRadius: 2.5 },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    fontFamily: FONTS.display,
    letterSpacing: 3,
    fontSize: 11,
    color: C.textDim,
  },
  status: { fontFamily: FONTS.display, letterSpacing: 1, fontSize: 10 },
  cd: { fontFamily: FONTS.mono, fontSize: 9, color: C.textDim },
  need: { fontFamily: FONTS.mono, fontSize: 9, color: C.textDim },
  btn: {
    borderRadius: 11,
    borderWidth: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontFamily: FONTS.display, letterSpacing: 1, fontSize: 10.5 },

  lockShell: {
    width: 216,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(120,130,140,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  lockPct: { fontFamily: FONTS.monoBold, fontSize: 13 },

  smallShell: {
    width: 170,
    minHeight: 170,
    padding: 15,
    borderRadius: 20,
    backgroundColor: '#0b0e13',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#20252e',
  },
  bigPct: {
    fontFamily: FONTS.display,
    fontSize: 38,
    marginTop: 8,
    marginBottom: 6,
  },

  mediumShell: {
    width: 360,
    padding: 14,
    borderRadius: 20,
    gap: 9,
    backgroundColor: '#0b0e13',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#20252e',
  },
  mTopRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  mLeft: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#1a1f28',
    paddingRight: 14,
  },
  mBig: { fontFamily: FONTS.display, fontSize: 33, marginVertical: 3 },
  mMid: { flex: 1, gap: 7 },
  mTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  alcBox: {
    borderWidth: 1,
    borderColor: '#2a2115',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingTop: 12,
    paddingBottom: 9,
  },
  alcLabel: {
    position: 'absolute',
    top: -8,
    left: 12,
    backgroundColor: '#0b0e13',
    paddingHorizontal: 7,
    fontFamily: FONTS.display,
    fontSize: 9,
    letterSpacing: 3,
    color: C.amber,
  },
  alcBtns: { flexDirection: 'row', gap: 7 },
  alcBtn: { flex: 1, paddingVertical: 8, paddingHorizontal: 4 },
});
