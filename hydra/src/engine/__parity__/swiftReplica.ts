/**
 * Line-by-line transliteration of the NEW targets/widget/HydrationEngine.swift.
 * Exists only so the Swift rewrite can be diffed against the Jest-covered TS
 * engine on a machine with no Swift toolchain. Not shipped.
 */
import {
  UserProfile, HydrationEvent, HydrationState, SportIntensity, Zone,
  DEFAULT_PROFILE, dailyNeedMl, anchorLevelMl, baseDrainMlPerHour,
  sweatRateMlPerHour, ethanolGrams, peakPoisonExtra, alcoholDiuresisMl,
  zoneOf, resolveInitialLevelPct, MAX_WATER_ABSORB_ML_PER_H, ABSORB_WINDOW_MS,
  POISON_WINDOW_MS,
} from '../hydrationEngine';

const POISON_PEAK_MS = 2 * 3600_000;
const SLEEP_MULTIPLIER = 0.4;
const STEP_MS = 60_000;
export const FORECAST_HORIZON_MS = 6 * 3600_000;

function tempMultiplier(t: number | null) {
  if (t == null) return 1.0;
  if (t < 18) return 0.9;
  if (t < 25) return 1.0;
  if (t <= 30) return 1.2;
  return 1.4;
}
function altitudeMultiplier(a: number) { return a > 2500 ? 1.03 : 1.0; }
function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }

// —— TZOffsetCache / localHour / isSleeping (the Calendar-free rewrite) ——
class TZOffsetCache {
  private lastDay = -Infinity;
  private offsetSec = 0;
  offset(ms: number): number {
    const day = Math.floor(ms / 86_400_000);
    if (day !== this.lastDay) {
      this.lastDay = day;
      // Swift: TimeZone.current.secondsFromGMT(for:) — same quantity as this.
      this.offsetSec = -new Date(ms).getTimezoneOffset() * 60;
    }
    return this.offsetSec;
  }
}
function localHour(ms: number, tz: TZOffsetCache): number {
  const local = ms / 1000 + tz.offset(ms);
  let s = local % 86_400;
  if (s < 0) s += 86_400;
  return s / 3600;
}
function isSleepingH(h: number, p: UserProfile): boolean {
  const a = p.sleepStartHour, b = p.sleepEndHour;
  if (a === b) return false;
  return a < b ? h >= a && h < b : h >= a || h < b;
}

function applyPatch(patch: Partial<UserProfile>, p: UserProfile): UserProfile {
  return { ...p, ...patch };
}
function effectiveProfile(events: HydrationEvent[], at: number, base: UserProfile): UserProfile {
  let p = { ...base };
  for (const e of events) {
    if (e.at > at) break;
    if (e.type === 'profile') p = applyPatch(e.patch, p);
  }
  return p;
}
function drainMlPerMs(p: UserProfile, poisonMult: number, sleeping: boolean) {
  let mult = 1.0;
  mult *= tempMultiplier(p.ambientTempC);
  mult *= altitudeMultiplier(p.altitudeM);
  mult *= poisonMult;
  if (sleeping) mult *= SLEEP_MULTIPLIER;
  return (baseDrainMlPerHour(p) * mult) / 3600_000;
}

function fluidIntakeMl(e: HydrationEvent) {
  if (e.type === 'water' || e.type === 'electrolytes') return e.volumeMl;
  if (e.type === 'alcohol') return e.volumeMl * (1 - e.abv / 100);
  return 0;
}
function creditedWaterMl(sorted: HydrationEvent[]): number[] {
  const credited = new Array(sorted.length).fill(0);
  const win: { at: number; credited: number }[] = [];
  let used = 0, head = 0;
  for (let i = 0; i < sorted.length; i++) {
    const intake = fluidIntakeMl(sorted[i]);
    if (intake <= 0) continue;
    while (head < win.length && win[head].at <= sorted[i].at - ABSORB_WINDOW_MS) {
      used -= win[head].credited; head++;
    }
    const cred = Math.min(intake, Math.max(0, MAX_WATER_ABSORB_ML_PER_H - used));
    credited[i] = cred;
    if (cred > 0) { win.push({ at: sorted[i].at, credited: cred }); used += cred; }
  }
  return credited;
}

// —— Derived ——
class Derived {
  sorted: HydrationEvent[];
  profileEvts: { at: number; patch: Partial<UserProfile> }[] = [];
  alcohol: { at: number; peak: number }[] = [];
  sport: { at: number; endAt: number; intensity: SportIntensity }[] = [];
  credited: number[];
  constructor(events: HydrationEvent[]) {
    const s = [...events].sort((a, b) => a.at - b.at);
    for (const e of s) {
      if (e.type === 'profile') this.profileEvts.push({ at: e.at, patch: e.patch });
      else if (e.type === 'alcohol')
        this.alcohol.push({ at: e.at, peak: peakPoisonExtra(ethanolGrams(e.volumeMl, e.abv), e.abv) });
      else if (e.type === 'sport')
        this.sport.push({ at: e.at, endAt: e.at + e.durationMin * 60_000, intensity: e.intensity });
    }
    this.sorted = s;
    this.credited = creditedWaterMl(s);
  }
}
export function derive(events: HydrationEvent[]) { return new Derived(events); }

function poisonMultFrom(alcohol: Derived['alcohol'], t: number) {
  let extra = 0;
  for (const a of alcohol) {
    if (a.at > t) break;
    const dt = t - a.at;
    if (dt > POISON_WINDOW_MS) continue;
    extra += a.peak * Math.min(dt / POISON_PEAK_MS, (POISON_WINDOW_MS - dt) / POISON_PEAK_MS);
  }
  return Math.min(3.0, 1.0 + extra);
}
function sportLossFrom(sport: Derived['sport'], t0: number, t1: number, p: UserProfile) {
  let loss = 0;
  for (const e of sport) {
    if (e.at >= t1) break;
    const s = Math.max(e.at, t0), en = Math.min(e.endAt, t1);
    if (en <= s) continue;
    loss += (sweatRateMlPerHour(p, e.intensity) * (en - s)) / 3600_000;
  }
  return loss;
}
function poisonEndsAt(events: HydrationEvent[], now: number): number | null {
  let end: number | null = null;
  for (const e of events) {
    if (e.type !== 'alcohol') continue;
    const we = e.at + POISON_WINDOW_MS;
    if (now <= we) end = end == null ? we : Math.max(end, we);
  }
  return end;
}

function stepLoss(d: Derived, t: number, next: number, p: UserProfile, tz: TZOffsetCache) {
  const mid = (t + next) / 2;
  const poison = d.alcohol.length === 0 ? 1.0 : poisonMultFrom(d.alcohol, mid);
  let loss = drainMlPerMs(p, poison, isSleepingH(localHour(mid, tz), p)) * (next - t);
  if (d.sport.length > 0) loss += sportLossFrom(d.sport, t, next, p);
  return loss;
}

function integrateLoss(d: Derived, from: number, to: number, base: UserProfile, tz: TZOffsetCache) {
  if (to <= from) return 0;
  let acc = 0, t = from, pi = 0, p = base;
  while (pi < d.profileEvts.length && d.profileEvts[pi].at <= from) { p = applyPatch(d.profileEvts[pi].patch, p); pi++; }
  while (t < to) {
    const next = Math.min(t + STEP_MS, to);
    const mid = (t + next) / 2;
    while (pi < d.profileEvts.length && d.profileEvts[pi].at <= mid) { p = applyPatch(d.profileEvts[pi].patch, p); pi++; }
    acc += stepLoss(d, t, next, p, tz);
    t = next;
  }
  return acc;
}

function integrateLossFromAnchor(d: Derived, anchor: number, to: number, p: UserProfile) {
  const tz = new TZOffsetCache();
  let acc = 0, t = anchor;
  while (t < to) { const next = Math.min(t + STEP_MS, to); acc += stepLoss(d, t, next, p, tz); t = next; }
  return acc;
}

function caffeineNetMl(e: any) { const mg = e.caffeineMg ?? 90; return mg >= 500 ? e.volumeMl - 250 : e.volumeMl; }
function applyEventImpact(e: HydrationEvent, levelMl: number, cap: number, cred: number) {
  switch (e.type) {
    case 'water': return clamp(levelMl + cred, 0, cap);
    case 'electrolytes': return clamp(levelMl + cred * 1.1, 0, cap);
    case 'alcohol': return clamp(levelMl + cred - alcoholDiuresisMl(e.volumeMl, e.abv), 0, cap);
    case 'caffeine': return clamp(levelMl + caffeineNetMl(e), 0, cap);
    default: return levelMl;
  }
}

function rawLevelMl(d: Derived, at: number, base: UserProfile) {
  const sorted = d.sorted;
  let pi = 0, p = base;
  const advance = (upTo: number) => {
    while (pi < d.profileEvts.length && d.profileEvts[pi].at <= upTo) { p = applyPatch(d.profileEvts[pi].patch, p); pi++; }
  };
  advance(sorted[0].at);
  let levelMl = anchorLevelMl(p);
  let cursor = sorted[0].at;
  const tz = new TZOffsetCache();
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    levelMl -= integrateLoss(d, cursor, e.at, base, tz);
    advance(e.at);
    levelMl = applyEventImpact(e, levelMl, dailyNeedMl(p), d.credited[i]);
    cursor = e.at;
  }
  levelMl -= integrateLoss(d, cursor, at, base, tz);
  return levelMl;
}

function absorbedInWindow(d: Derived, at: number) {
  let used = 0;
  for (let i = 0; i < d.sorted.length; i++) {
    if (d.sorted[i].at > at) break;
    if (d.sorted[i].at > at - ABSORB_WINDOW_MS) used += d.credited[i];
  }
  return used;
}

function emptyState(profileNow: UserProfile): HydrationState {
  const capNow = dailyNeedMl(profileNow);
  const levelPct = resolveInitialLevelPct(profileNow);
  return {
    levelMl: clamp((capNow * levelPct) / 100, 0, capNow), dailyNeedMl: capNow, levelPct,
    zone: zoneOf(levelPct, false), poisoned: false, poisonUntil: null, poisonMult: 1,
    ambleAt: null, redAt: null, absorbedLastHourMl: 0,
    absorbCapMl: MAX_WATER_ABSORB_ML_PER_H, saturated: false,
  };
}

function assemble(d: Derived, at: number, levelMl: number, capNow: number,
                  ambleAt: number | null, redAt: number | null): HydrationState {
  const poisonMult = poisonMultFrom(d.alcohol, at);
  const poisoned = poisonMult > 1.0;
  const levelPct = (levelMl / capNow) * 100;
  const absorbed = absorbedInWindow(d, at);
  return {
    levelMl, dailyNeedMl: capNow, levelPct, zone: zoneOf(levelPct, poisoned), poisoned,
    poisonUntil: poisoned ? poisonEndsAt(d.sorted, at) : null, poisonMult,
    ambleAt, redAt, absorbedLastHourMl: absorbed, absorbCapMl: MAX_WATER_ABSORB_ML_PER_H,
    saturated: absorbed >= MAX_WATER_ABSORB_ML_PER_H * 0.98,
  };
}

export function computeStateSwift(events: HydrationEvent[], at: number, base = DEFAULT_PROFILE): HydrationState {
  return computeStateD(derive(events), at, base);
}
function computeStateD(d: Derived, at: number, base: UserProfile): HydrationState {
  const profileNow = effectiveProfile(d.sorted, at, base);
  if (d.sorted.length === 0) return emptyState(profileNow);
  const capNow = dailyNeedMl(profileNow);
  const levelMl = clamp(rawLevelMl(d, at, base), 0, capNow);
  const [ambleAt, redAt] = forecastFrom(d, at, levelMl, base, FORECAST_HORIZON_MS);
  return assemble(d, at, levelMl, capNow, ambleAt, redAt);
}

function crossingAt(t0: number | null, at: number, horizonEnd: number) {
  if (t0 == null) return null;
  if (t0 <= at) return at;
  return t0 <= horizonEnd ? t0 : null;
}

export function computeStateSeriesSwift(events: HydrationEvent[], ats: number[], base = DEFAULT_PROFILE): HydrationState[] {
  if (ats.length === 0) return [];
  const d = derive(events);
  const sorted = d.sorted;
  const first = ats[0];
  const last = sorted[sorted.length - 1];
  if (!last || last.at > first) return ats.map((a) => computeStateD(d, a, base));

  const anchor = last.at;
  const p = effectiveProfile(sorted, anchor, base);
  const capNow = dailyNeedMl(p);
  const anchorLevel = rawLevelMl(d, anchor, base);
  const span = ats[ats.length - 1] - first;
  const [amber0, red0] = forecastFrom(
    d, first, clamp(anchorLevel - integrateLossFromAnchor(d, anchor, first, p), 0, capNow),
    base, FORECAST_HORIZON_MS + span);

  const tz = new TZOffsetCache();
  let lost = 0, gridT = anchor;
  const out: HydrationState[] = [];
  for (const at of ats) {
    while (gridT + STEP_MS <= at) { lost += stepLoss(d, gridT, gridT + STEP_MS, p, tz); gridT += STEP_MS; }
    const tail = gridT < at ? stepLoss(d, gridT, at, p, tz) : 0;
    const he = at + FORECAST_HORIZON_MS;
    out.push(assemble(d, at, clamp(anchorLevel - (lost + tail), 0, capNow), capNow,
      crossingAt(amber0, at, he), crossingAt(red0, at, he)));
  }
  return out;
}

function forecastFrom(d: Derived, at: number, startLevelMl: number, base: UserProfile, horizonMs: number):
    [number | null, number | null] {
  const cap = dailyNeedMl(effectiveProfile(d.sorted, at, base));
  const amberT = cap * 0.55, redT = cap * 0.25;
  let ambleAt: number | null = startLevelMl <= amberT ? at : null;
  let redAt: number | null = startLevelMl < redT ? at : null;
  if (ambleAt != null && redAt != null) return [ambleAt, redAt];
  let pi = 0, p = base;
  while (pi < d.profileEvts.length && d.profileEvts[pi].at <= at) { p = applyPatch(d.profileEvts[pi].patch, p); pi++; }
  const hasSport = d.sport.length > 0;
  const tz = new TZOffsetCache();
  let level = startLevelMl, t = at;
  const end = at + horizonMs;
  while (t < end) {
    const next = Math.min(t + STEP_MS, end);
    const dt = next - t, mid = (t + next) / 2;
    while (pi < d.profileEvts.length && d.profileEvts[pi].at <= mid) { p = applyPatch(d.profileEvts[pi].patch, p); pi++; }
    const poison = poisonMultFrom(d.alcohol, mid);
    const before = level;
    let loss = drainMlPerMs(p, poison, isSleepingH(localHour(mid, tz), p)) * dt;
    if (hasSport) loss += sportLossFrom(d.sport, t, next, p);
    const after = before - loss;
    if (ambleAt == null && after <= amberT) ambleAt = t + (loss > 0 ? (before - amberT) / loss : 0) * dt;
    if (redAt == null && after < redT) { redAt = t + (loss > 0 ? (before - redT) / loss : 0) * dt; break; }
    level = after; t = next;
  }
  return [ambleAt, redAt];
}
