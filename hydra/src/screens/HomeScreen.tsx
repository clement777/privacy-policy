import React, { useEffect, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { ScrollView, StyleSheet, Text, View, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SportActiveIndicator } from '../components/SportActiveIndicator';
import { InfoTip } from '../components/InfoTip';
import { HydrationBar } from '../components/HydrationBar';
import { LogButton } from '../components/LogButton';
import { SportLogModal } from '../components/SportLogModal';
import { useHydration } from '../store/useHydration';
import {
  absorptionRecoveryAt,
  computeState,
  forecastZoneCrossings,
  SportIntensity,
} from '../engine/hydrationEngine';
import { C, FONTS } from '../theme/colors';
import { formatCountdownPrecise } from '../util/time';
import { greenStreak } from '../util/stats';
import { vagueHint } from '../content/metricHints';
import {
  activeSportSessions,
  formatSportRemaining,
} from '../util/sport';

const DISPLAY_FORECAST_MS = 24 * 3600_000;

export function HomeScreen() {
  const { events, profile, widget, logPreset, logWater, logSport, undo } =
    useHydration();
  const [nowMs, setNowMs] = useState(Date.now());
  const [toast, setToast] = useState<string | null>(null);
  const [sportOpen, setSportOpen] = useState(false);

  // Tick every second so the countdowns stay second-precise.
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // The physiological state is a far heavier computation than a countdown, and
  // the bar only drains ~2 mL per minute — recomputing it 60× a minute was
  // invisible on screen but dominated the main thread (and made every tap feel
  // sluggish). Quantize its clock to 10 s; the countdowns below keep using the
  // 1 s `nowMs` because they just subtract from a fixed target timestamp.
  const stateNow = Math.floor(nowMs / 10_000) * 10_000;

  const state = useMemo(
    () => computeState(events, stateNow, profile),
    [events, profile, stateNow]
  );

  const redAt = useMemo(
    () =>
      state.redAt ??
      forecastZoneCrossings(
        events,
        stateNow,
        state.levelMl,
        profile,
        DISPLAY_FORECAST_MS
      ).redAt,
    [events, profile, stateNow, state.levelMl, state.redAt]
  );

  // The streak only changes on a day boundary, but it walks the whole history
  // — it was re-running on every single render (no memo at all).
  const streak = useMemo(
    () => greenStreak(events, stateNow, state.dailyNeedMl),
    [events, stateNow, state.dailyNeedMl]
  );
  const streakLabel =
    streak > 0 ? `🌊 VAGUE ${streak}J` : '🌊 LANCE TA VAGUE';
  const streakHint = vagueHint(state.dailyNeedMl);

  const sportSessions = useMemo(
    () => activeSportSessions(events, stateNow, profile),
    [events, stateNow, profile]
  );
  const sportActive = sportSessions.length > 0;

  // When the rolling-hour absorption cap is maxed out, the exact instant the
  // body can take water again — a fixed timestamp, so the countdown that
  // renders it can still tick every second off `nowMs`.
  const recoverAt = useMemo(
    () => absorptionRecoveryAt(events, stateNow),
    [events, stateNow]
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const onSaturated = () => {
    // The persistent banner (with its live countdown) already explains the
    // block, so a warning haptic is enough here — no transient toast on top.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  };

  const drink = async (key: string) => {
    const r = await logPreset(key);
    if (!r.ok && r.reason === 'saturated') onSaturated();
  };

  const drinkWater = async () => {
    const r = await logWater(widget.defaultWaterMl);
    if (!r.ok && r.reason === 'saturated') onSaturated();
  };

  const onSportBlocked = (remainingSec: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    showToast(
      `SÉANCE EN COURS · termine dans ${formatSportRemaining(remainingSec)}`
    );
  };

  const openSport = () => {
    if (sportActive && sportSessions[0]) {
      onSportBlocked(sportSessions[0].remainingSec);
      return;
    }
    setSportOpen(true);
  };

  const onSport = async (durationMin: number, intensity: SportIntensity) => {
    const r = await logSport(durationMin, intensity);
    if (!r.ok && r.reason === 'session_active') {
      onSportBlocked(r.remainingSec);
      return;
    }
    showToast(`SÉANCE DÉMARRÉE · ${durationMin} min · sueur en cours`);
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.brandLogo}
              accessibilityLabel="Logo HYDRA"
            />
            <Text style={styles.brand}>HYDRA</Text>
          </View>
          <View style={styles.streakWrap}>
            <Text style={styles.streak}>{streakLabel}</Text>
            <InfoTip
              title={streakHint.title}
              body={streakHint.body}
              accessibilityLabel="Détails de ta vague"
            />
          </View>
        </View>
        <View style={styles.body}>
          <SportActiveIndicator sessions={sportSessions} />
          <HydrationBar
            state={state}
            segments={20}
            height={56}
            sportActive={sportActive}
          />

          <View style={styles.countdownRow}>
            <Text style={styles.cdLabel}>ROUGE DANS</Text>
            <Text style={styles.cdVal}>
              {formatCountdownPrecise(redAt, nowMs)}
            </Text>
          </View>

          {state.saturated ? (
            <View style={styles.satBanner}>
              <Text style={styles.satText}>
                SATURÉ · ton corps ne peut pas absorber plus vite.
              </Text>
              <Text style={styles.satText}>
                Attends encore{' '}
                <Text style={styles.satTimer}>
                  {recoverAt ? formatCountdownPrecise(recoverAt, nowMs) : '—'}
                </Text>{' '}
                avant de reboire de l'eau.
              </Text>
            </View>
          ) : null}

          {toast ? <Text style={styles.toast}>{toast}</Text> : null}

          <LogButton
            label="EAU"
            sub={`+${widget.defaultWaterMl} ml`}
            color={C.segmentFull}
            onPress={drinkWater}
          />

          <View style={styles.grid}>
            <LogButton
              label="ALCOOL LÉGER"
              sub="2–8°"
              color={C.amber}
              onPress={() => drink('alcohol_light')}
            />
            <LogButton
              label="ALCOOL MOYEN"
              sub="9–22°"
              color={C.amber}
              onPress={() => drink('alcohol_medium')}
            />
          </View>

          <LogButton
            label="ALCOOL FORT"
            sub="30–45°  spiritueux"
            color={C.red}
            onPress={() => drink('alcohol_strong')}
          />

          <LogButton
            label="SPORT"
            sub={
              sportActive
                ? 'séance en cours'
                : 'modéré ou intense · durée'
            }
            color={sportActive ? C.textDim : C.text}
            onPress={openSport}
          />

          <LogButton
            label="ANNULER LE DERNIER AJOUT"
            sub="retire eau, alcool ou sport"
            color={C.textDim}
            onPress={() => undo()}
          />

          <Text style={styles.footHint}>
            Besoin quotidien : {Math.round(state.dailyNeedMl)} mL (
            {profile.weightKg} kg × 32) · absorbé cette heure{' '}
            {Math.round(state.absorbedLastHourMl)}/{state.absorbCapMl} mL
          </Text>
        </View>
      </ScrollView>

      <SportLogModal
        visible={sportOpen}
        onClose={() => setSportOpen(false)}
        onConfirm={onSport}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogo: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  brand: {
    color: C.text,
    fontFamily: FONTS.display,
    fontSize: 28,
    letterSpacing: 6,
  },
  streakWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '52%',
  },
  streak: { color: C.textDim, fontFamily: FONTS.mono, fontSize: 14 },
  body: { paddingHorizontal: 20, gap: 12 },
  countdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  cdLabel: {
    color: C.textDim,
    fontFamily: FONTS.label,
    letterSpacing: 2,
  },
  cdVal: { color: C.text, fontFamily: FONTS.monoBold, fontSize: 20 },
  grid: { flexDirection: 'row', gap: 12 },
  toast: {
    color: C.poison,
    fontFamily: FONTS.label,
    fontSize: 12,
    letterSpacing: 1,
    textAlign: 'center',
    paddingVertical: 6,
  },
  satBanner: {
    borderWidth: 1,
    borderColor: C.poison,
    borderRadius: 12,
    backgroundColor: 'rgba(180,76,255,0.10)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 3,
  },
  satText: {
    color: C.poison,
    fontFamily: FONTS.label,
    fontSize: 12,
    letterSpacing: 1,
    textAlign: 'center',
  },
  satTimer: {
    fontFamily: FONTS.monoBold,
    letterSpacing: 1,
  },
  footHint: {
    marginTop: 16,
    textAlign: 'center',
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 11,
  },
});
