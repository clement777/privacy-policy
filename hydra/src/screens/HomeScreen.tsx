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
import { useT } from '../i18n';

const DISPLAY_FORECAST_MS = 24 * 3600_000;

export function HomeScreen() {
  const { events, profile, widget, logPreset, logWater, logSport, undo } =
    useHydration();
  const tr = useT();
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
    streak > 0 ? tr('home.streak', { n: streak }) : tr('home.streakEmpty');
  const streakHint = vagueHint(state.dailyNeedMl, tr);

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
      tr('home.sessionBlocked', { time: formatSportRemaining(remainingSec) })
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
    showToast(tr('home.sessionStarted', { min: durationMin }));
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.brandLogo}
              accessibilityLabel={tr('home.logoA11y')}
            />
            <Text style={styles.brand}>HYDRA</Text>
          </View>
          <View style={styles.streakWrap}>
            <Text style={styles.streak}>{streakLabel}</Text>
            <InfoTip
              title={streakHint.title}
              body={streakHint.body}
              accessibilityLabel={tr('home.streakA11y')}
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
            <Text style={styles.cdLabel}>{tr('home.redIn')}</Text>
            <Text style={styles.cdVal}>
              {formatCountdownPrecise(redAt, nowMs)}
            </Text>
          </View>

          {state.saturated ? (
            <View style={styles.satBanner}>
              <Text style={styles.satText}>{tr('home.saturated')}</Text>
              <Text style={styles.satText}>
                {tr('home.saturatedWait', {
                  timer: recoverAt
                    ? formatCountdownPrecise(recoverAt, nowMs)
                    : '—',
                })}
              </Text>
            </View>
          ) : null}

          {toast ? <Text style={styles.toast}>{toast}</Text> : null}

          <LogButton
            label={tr('home.water')}
            sub={`+${widget.defaultWaterMl} ml`}
            color={C.segmentFull}
            onPress={drinkWater}
          />

          <View style={styles.grid}>
            <LogButton
              label={tr('home.alcoholLight')}
              sub={tr('home.alcoholLightSub')}
              color={C.amber}
              onPress={() => drink('alcohol_light')}
            />
            <LogButton
              label={tr('home.alcoholMedium')}
              sub={tr('home.alcoholMediumSub')}
              color={C.amber}
              onPress={() => drink('alcohol_medium')}
            />
          </View>

          <LogButton
            label={tr('home.alcoholStrong')}
            sub={tr('home.alcoholStrongSub')}
            color={C.red}
            onPress={() => drink('alcohol_strong')}
          />

          <LogButton
            label={tr('home.sport')}
            sub={tr(sportActive ? 'home.sportRunning' : 'home.sportIdle')}
            color={sportActive ? C.textDim : C.text}
            onPress={openSport}
          />

          <LogButton
            label={tr('home.undo')}
            sub={tr('home.undoSub')}
            color={C.textDim}
            onPress={() => undo()}
          />

          <Text style={styles.footHint}>
            {tr('home.footHint', {
              need: Math.round(state.dailyNeedMl),
              kg: profile.weightKg,
              used: Math.round(state.absorbedLastHourMl),
              cap: state.absorbCapMl,
            })}
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
