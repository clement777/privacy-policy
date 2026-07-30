/**
 * Guards the Swift widget engine against the TS engine it is a port of.
 * swiftReplica.ts is a transliteration of targets/widget/HydrationEngine.swift,
 * so a green run here means the widget shows the same bar as the app.
 */
import { computeState, DEFAULT_PROFILE, HydrationEvent, UserProfile } from '../hydrationEngine';
import { computeStateSwift, computeStateSeriesSwift } from './swiftReplica';

const H = 3600_000;
const NOW = new Date('2026-03-14T15:20:00Z').getTime();
const P: UserProfile = { ...DEFAULT_PROFILE, weightKg: 70, initialLevelPct: 55 };

function waterDays(days: number, hours: number[], ml = 250): HydrationEvent[] {
  const ev: HydrationEvent[] = [];
  for (let d = days; d >= 0; d--)
    for (const h of hours) {
      const t = NOW - d * 24 * H + (h - 15) * H;
      if (t <= NOW) ev.push({ type: 'water', at: t, volumeMl: ml });
    }
  return ev;
}

const FIXTURES: [string, HydrationEvent[], UserProfile][] = [
  ['empty log', [], P],
  ['7 days of water', waterDays(7, [8, 10, 12, 14, 16, 18, 20]), P],
  ['30 days of water', waterDays(30, [9, 13, 19], 400), P],
  ['90 days of water', waterDays(90, [9, 13, 19], 400), P],
  ['alcohol inside the poison window', [
    { type: 'water', at: NOW - 30 * H, volumeMl: 500 },
    { type: 'alcohol', at: NOW - 1.5 * H, volumeMl: 150, abv: 14 },
    { type: 'alcohol', at: NOW - 0.5 * H, volumeMl: 40, abv: 40 },
    { type: 'water', at: NOW - 10 * 60_000, volumeMl: 250 },
  ], P],
  ['sport session straddling now', [
    { type: 'water', at: NOW - 20 * H, volumeMl: 500 },
    { type: 'sport', at: NOW - 20 * 60_000, durationMin: 90, intensity: 'intense' },
  ], P],
  ['profile changes mid-history', [
    { type: 'profile', at: NOW - 40 * H, patch: { weightKg: 60, initialLevelPct: 35 } },
    { type: 'water', at: NOW - 39 * H, volumeMl: 500 },
    { type: 'profile', at: NOW - 12 * H, patch: { weightKg: 95, ambientTempC: 31 } },
    { type: 'water', at: NOW - 2 * H, volumeMl: 750 },
  ], P],
  ['saturated absorption', [
    { type: 'water', at: NOW - 26 * H, volumeMl: 250 },
    ...[0, 1, 2, 3, 4].map((k): HydrationEvent =>
      ({ type: 'water', at: NOW - (40 - k * 8) * 60_000, volumeMl: 500 })),
  ], P],
  ['already in the red', [{ type: 'water', at: NOW - 60 * H, volumeMl: 250 }],
    { ...P, initialLevelPct: 20 }],
  ['electrolytes + caffeine mix', [
    { type: 'electrolytes', at: NOW - 5 * H, volumeMl: 500 },
    { type: 'caffeine', at: NOW - 4 * H, volumeMl: 100, caffeineMg: 90 },
    { type: 'caffeine', at: NOW - 3 * H, volumeMl: 300, caffeineMg: 600 },
  ], P],
];

describe('Swift widget engine ≡ TS engine', () => {
  it.each(FIXTURES)('computeState matches on: %s', (_n, events, profile) => {
    for (const at of [NOW, NOW + 37 * 60_000, NOW + 3 * H]) {
      const swift = computeStateSwift(events, at, profile);
      const ts = computeState(events, at, profile);
      expect(swift.levelMl).toBeCloseTo(ts.levelMl, 6);
      expect(swift.dailyNeedMl).toBeCloseTo(ts.dailyNeedMl, 6);
      expect(swift.levelPct).toBeCloseTo(ts.levelPct, 6);
      expect(swift.zone).toBe(ts.zone);
      expect(swift.poisoned).toBe(ts.poisoned);
      expect(swift.poisonMult).toBeCloseTo(ts.poisonMult, 9);
      expect(swift.poisonUntil).toEqual(ts.poisonUntil);
      expect(swift.absorbedLastHourMl).toBeCloseTo(ts.absorbedLastHourMl, 6);
      expect(swift.saturated).toBe(ts.saturated);
      if (ts.ambleAt == null) expect(swift.ambleAt).toBeNull();
      else expect(swift.ambleAt!).toBeCloseTo(ts.ambleAt, 3);
      if (ts.redAt == null) expect(swift.redAt).toBeNull();
      else expect(swift.redAt!).toBeCloseTo(ts.redAt, 3);
    }
  });
});

// The widget's timeline: 2-min entries over 4 h, built in ONE incremental pass.
const ATS: number[] = [];
for (let i = 0; i <= 4 * H; i += 2 * 60_000) ATS.push(NOW + i);

describe('computeStateSeries ≡ per-entry computeState', () => {
  it.each(FIXTURES)('every timeline entry matches on: %s', (_n, events, profile) => {
    const series = computeStateSeriesSwift(events, ATS, profile);
    expect(series).toHaveLength(ATS.length);
    ATS.forEach((at, i) => {
      const ref = computeState(events, at, profile);
      const got = series[i];
      // Anchored on the same grid as computeState → identical to float noise.
      expect(got.levelMl).toBeCloseTo(ref.levelMl, 9);
      expect(Math.round(got.levelPct)).toBe(Math.round(ref.levelPct));
      expect(got.zone).toBe(ref.zone);
      expect(got.dailyNeedMl).toBeCloseTo(ref.dailyNeedMl, 6);
      expect(got.saturated).toBe(ref.saturated);
      expect(got.poisoned).toBe(ref.poisoned);
      expect(got.absorbedLastHourMl).toBeCloseTo(ref.absorbedLastHourMl, 6);
      if (ref.redAt == null) expect(got.redAt).toBeNull();
      else expect(got.redAt!).toBeCloseTo(ref.redAt, -3.5); // within ~2 s
    });
  });
});
