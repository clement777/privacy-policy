import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHydration } from '../store/useHydration';
import { C, FONTS, RADIUS } from '../theme/colors';
import { InfoTip } from '../components/InfoTip';
import { vagueHint } from '../content/metricHints';
import { dailyNeedMl, HydrationEvent } from '../engine/hydrationEngine';
import {
  consumptionRecap,
  dayDrinkStats,
  greenStreak,
  greenTimePctToday,
  isSameDay,
  lastNDaysPoisoned,
  lastNDaysWater,
  lifetimeTotals,
  poisonedMsThisWeek,
  poisonFreeStreak,
} from '../util/stats';
import { currentBcp47, StringKey, useT } from '../i18n';

type Translate = (key: StringKey, params?: Record<string, string | number>) => string;

// "2 h 05" / "45 min" / "0" — compact poisoned-time label.
function formatDuration(ms: number, tr: Translate): string {
  const totalMin = Math.round(ms / 60_000);
  if (totalMin <= 0) return '0';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return tr('data.durationMin', { m });
  return tr('data.durationHm', { h, m: String(m).padStart(2, '0') });
}

// « 15 janv. 2026 » / "15 Jan 2026" — la date suit la langue choisie dans
// l'app, pas celle du système : quelqu'un qui met HYDRA en anglais sur un
// iPhone français ne veut pas d'une date à moitié traduite.
function formatSince(ms: number): string {
  return new Date(ms).toLocaleDateString(currentBcp47(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function labelFor(
  e: HydrationEvent,
  tr: Translate
): { text: string; color: string } {
  switch (e.type) {
    case 'water':
      return { text: tr('data.evt.water', { ml: e.volumeMl }), color: C.segmentFull };
    case 'electrolytes':
      return {
        text: tr('data.evt.electrolytes', { ml: e.volumeMl }),
        color: C.segmentFull,
      };
    case 'alcohol':
      return {
        text: tr('data.evt.alcohol', { ml: e.volumeMl, abv: e.abv }),
        color: C.poison,
      };
    case 'caffeine':
      return { text: tr('data.evt.caffeine', { ml: e.volumeMl }), color: C.textDim };
    case 'sport':
      return {
        text: tr('data.evt.sport', {
          intensity: tr(
            e.intensity === 'intense'
              ? 'sport.intense'
              : e.intensity === 'light'
              ? 'sport.light'
              : 'sport.moderate'
          ),
          min: e.durationMin,
        }),
        color: C.amber,
      };
    case 'profile':
      return { text: tr('data.evt.profile'), color: C.textDim };
  }
}

function StatCard({
  value,
  unit,
  label,
  color = C.text,
  hintTitle,
  hintBody,
}: {
  value: string;
  unit?: string;
  label: string;
  color?: string;
  hintTitle?: string;
  hintBody?: string;
}) {
  return (
    <View style={styles.card}>
      <Text style={[styles.cardValue, { color }]}>
        {value}
        {unit ? <Text style={styles.cardUnit}> {unit}</Text> : null}
      </Text>
      <View style={styles.cardLabelRow}>
        <Text style={styles.cardLabel}>{label}</Text>
        {hintTitle && hintBody ? (
          <InfoTip
            title={hintTitle}
            body={hintBody}
            accessibilityLabel={undefined}
          />
        ) : null}
      </View>
    </View>
  );
}

export function DataScreen() {
  const { events, profile, deleteEvent } = useHydration();
  const tr = useT();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const goal = dailyNeedMl(profile);
  const today = useMemo(() => dayDrinkStats(events, now), [events, now]);
  const greenPct = useMemo(
    () => greenTimePctToday(events, now, profile),
    [events, now, profile]
  );
  const streak = useMemo(
    () => greenStreak(events, now, goal),
    [events, now, goal]
  );
  const streakHint = vagueHint(goal, tr);
  // Dimanche → samedi, dans la langue courante.
  const weekdayLetters = tr('data.weekdayLetters').split(',');
  const bars = useMemo(() => lastNDaysWater(events, now, 7), [events, now]);
  const maxBar = Math.max(goal, ...bars.map((b) => b.waterMl), 1);

  const poisonWeekMs = useMemo(
    () => poisonedMsThisWeek(events, now),
    [events, now]
  );
  const cleanStreak = useMemo(
    () => poisonFreeStreak(events, now),
    [events, now]
  );
  const poisonBars = useMemo(
    () => lastNDaysPoisoned(events, now, 7),
    [events, now]
  );
  const maxPoisonMs = Math.max(...poisonBars.map((b) => b.poisonedMs), 1);
  const recap = useMemo(() => consumptionRecap(events, now, 30), [events, now]);
  const totals = useMemo(() => lifetimeTotals(events), [events]);

  const items = events.filter((e) => isSameDay(e.at, now)).reverse();

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={styles.title}>{tr('data.title')}</Text>

        <View style={styles.cardRow}>
          <StatCard
            value={(today.waterMl / 1000).toFixed(today.waterMl >= 1000 ? 2 : 1)}
            unit="L"
            label={tr('data.drunkToday')}
            color={C.segmentFull}
          />
          <StatCard value={String(today.glasses)} label={tr('data.glasses')} />
        </View>
        <View style={styles.cardRow}>
          <StatCard
            value={`${greenPct}`}
            unit="%"
            label={tr('data.greenTime')}
            color={greenPct >= 60 ? C.segmentFull : C.amber}
          />
          <StatCard
            value={String(streak)}
            unit="J"
            label={tr('data.wave')}
            hintTitle={streakHint.title}
            hintBody={streakHint.body}
            color={streak > 0 ? C.segmentFull : C.textDim}
          />
        </View>

        <Text style={styles.section}>{tr('data.sinceStart')}</Text>
        <View style={styles.cardRow}>
          <StatCard
            value={(totals.waterMl / 1000).toFixed(totals.waterMl >= 10_000 ? 0 : 1)}
            unit="L"
            label={tr('data.waterTotal')}
            color={C.segmentFull}
          />
          <StatCard
            value={String(totals.alcoholUnits)}
            label={tr('data.alcoholTotal')}
            color={totals.alcoholUnits > 0 ? C.poison : C.textDim}
          />
        </View>
        <Text style={styles.chartHint}>
          {totals.sinceMs
            ? tr('data.sinceLine', { date: formatSince(totals.sinceMs) })
            : tr('data.sinceEmpty')}
        </Text>

        <Text style={styles.section}>{tr('data.last7')}</Text>
        <View style={styles.chart}>
          {bars.map((b, i) => {
            const h = Math.max(2, (b.waterMl / maxBar) * 90);
            const reached = b.waterMl >= goal;
            const isToday = i === bars.length - 1;
            return (
              <View key={b.dayStart} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: h,
                        backgroundColor: reached
                          ? C.segmentFull
                          : b.waterMl > 0
                          ? C.amber
                          : C.segmentEmpty,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.barLabel,
                    isToday && { color: C.text, fontFamily: FONTS.monoBold },
                  ]}
                >
                  {weekdayLetters[b.weekday] ?? ''}
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.chartHint}>
          {tr('data.goalHint', { ml: Math.round(goal) })}
        </Text>

        <Text style={[styles.section, styles.sectionPoison]}>
          {tr('data.poisoning')}
        </Text>
        <View style={styles.cardRow}>
          <StatCard
            value={formatDuration(poisonWeekMs, tr)}
            label={tr('data.purpleWeek')}
            color={poisonWeekMs > 0 ? C.poison : C.segmentFull}
          />
          <StatCard
            value={String(cleanStreak)}
            label={tr('data.alcoholFreeDays')}
            color={cleanStreak > 0 ? C.segmentFull : C.textDim}
          />
        </View>
        <View style={[styles.chart, styles.chartPoison]}>
          {poisonBars.map((b, i) => {
            const h = Math.max(2, (b.poisonedMs / maxPoisonMs) * 90);
            const isToday = i === poisonBars.length - 1;
            return (
              <View key={b.dayStart} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: h,
                        backgroundColor:
                          b.poisonedMs > 0 ? C.poison : C.poisonEmpty,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.barLabel,
                    isToday && { color: C.text, fontFamily: FONTS.monoBold },
                  ]}
                >
                  {weekdayLetters[b.weekday] ?? ''}
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.chartHint}>{tr('data.poisonHint')}</Text>

        <Text style={styles.section}>{tr('data.last30')}</Text>
        <View style={styles.cardRow}>
          <StatCard
            value={(recap.waterMl / 1000).toFixed(1)}
            unit="L"
            label={tr('data.waterDrunk')}
            color={C.segmentFull}
          />
          <StatCard
            value={String(recap.alcoholUnits)}
            label={tr('data.alcoholGlasses')}
            color={recap.alcoholUnits > 0 ? C.poison : C.textDim}
          />
        </View>
        <View style={styles.cardRow}>
          <StatCard
            value={formatDuration(recap.poisonedMs, tr)}
            label={tr('data.poisonedTime')}
            color={recap.poisonedMs > 0 ? C.poison : C.segmentFull}
          />
          <StatCard
            value={String(recap.cleanDays)}
            unit={`/ ${recap.cleanDays + recap.poisonedDays}`}
            label={tr('data.cleanDays')}
            color={C.segmentFull}
          />
        </View>

        <Text style={styles.section}>{tr('data.day')}</Text>
        {items.length === 0 ? (
          <Text style={styles.empty}>{tr('data.empty')}</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {items.map((item) => {
              const t = new Date(item.at);
              const hh = t.getHours().toString().padStart(2, '0');
              const mm = t.getMinutes().toString().padStart(2, '0');
              const { text, color } = labelFor(item, tr);
              return (
                <View key={String(item.at) + item.type} style={styles.row}>
                  <Text style={styles.time}>
                    {hh}:{mm}
                  </Text>
                  <Text style={[styles.kind, { color }]}>{text}</Text>
                  <Pressable
                    onPress={() => deleteEvent(item.at)}
                    hitSlop={10}
                  >
                    <Text style={styles.del}>×</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  title: {
    color: C.text,
    fontFamily: FONTS.display,
    fontSize: 26,
    letterSpacing: 4,
    marginBottom: 16,
  },
  cardRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  card: {
    flex: 1,
    backgroundColor: C.bgSoft,
    borderRadius: RADIUS.lg,
    padding: 16,
  },
  cardValue: {
    color: C.text,
    fontFamily: FONTS.monoBold,
    fontSize: 30,
    letterSpacing: 1,
  },
  cardUnit: { fontFamily: FONTS.mono, fontSize: 14, color: C.textDim },
  cardLabel: {
    color: C.textDim,
    fontFamily: FONTS.label,
    fontSize: 10,
    letterSpacing: 1.5,
    flex: 1,
  },
  cardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  section: {
    color: C.textDim,
    fontFamily: FONTS.label,
    letterSpacing: 3,
    marginTop: 26,
    marginBottom: 12,
    fontSize: 11,
  },
  sectionPoison: {
    color: C.poison,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 118,
    backgroundColor: C.bgSoft,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
  },
  chartPoison: {
    borderWidth: 1,
    borderColor: 'rgba(180,76,255,0.22)',
  },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { height: 90, justifyContent: 'flex-end' },
  barFill: { width: 18, borderRadius: 4 },
  barLabel: { color: C.textDim, fontFamily: FONTS.mono, fontSize: 11 },
  chartHint: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 11,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: C.bgSoft,
    borderRadius: RADIUS.md,
    gap: 12,
  },
  time: { color: C.textDim, fontFamily: FONTS.mono },
  kind: { flex: 1, fontFamily: FONTS.label, letterSpacing: 2, fontSize: 12 },
  del: { color: C.red, fontSize: 22, paddingHorizontal: 8 },
  empty: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    textAlign: 'center',
    marginTop: 20,
  },
});
