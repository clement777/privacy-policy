// Pure, side-effect-free daily aggregates for the DONNÉES screen. Kept out of
// the engine so hydrationEngine.ts stays the single source of truth for the
// physiological model; these are just presentation-layer roll-ups.

import {
  computeState,
  DEFAULT_PROFILE,
  ethanolGrams,
  HydrationEvent,
  POISON_WINDOW_MS,
  UserProfile,
} from '../engine/hydrationEngine';

const DAY_MS = 24 * 3600_000;

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

const isDrink = (e: HydrationEvent) =>
  e.type === 'water' ||
  e.type === 'electrolytes' ||
  e.type === 'alcohol' ||
  e.type === 'caffeine';

export interface DayDrinkStats {
  waterMl: number; // water + electrolytes volume drunk that day
  glasses: number; // number of drink events (water/electro/alcohol/caffeine)
  alcoholUnits: number; // count of alcohol events
}

// Aggregate the raw volumes/counts for the calendar day containing `dayStart`.
export function dayDrinkStats(
  events: HydrationEvent[],
  dayStart: number
): DayDrinkStats {
  const start = startOfDay(dayStart);
  const end = start + DAY_MS;
  let waterMl = 0;
  let glasses = 0;
  let alcoholUnits = 0;
  for (const e of events) {
    if (e.at < start || e.at >= end) continue;
    if (!isDrink(e)) continue;
    glasses += 1;
    if (e.type === 'water' || e.type === 'electrolytes') waterMl += e.volumeMl;
    if (e.type === 'alcohol') alcoholUnits += 1;
  }
  return { waterMl, glasses, alcoholUnits };
}

export interface DayBar {
  dayStart: number;
  /** Jour de la semaine, 0 = dimanche. La LETTRE affichée dépend de la langue
   *  et se dérive au rendu : la calculer ici figerait « L M M J V S D » dans
   *  un mémo que rien ne recalcule quand la langue change. */
  weekday: number;
  waterMl: number;
}

// Water volume for each of the last `count` days, oldest first, newest last.
export function lastNDaysWater(
  events: HydrationEvent[],
  now: number,
  count = 7
): DayBar[] {
  const todayStart = startOfDay(now);
  const out: DayBar[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const dayStart = todayStart - i * DAY_MS;
    out.push({
      dayStart,
      weekday: new Date(dayStart).getDay(),
      waterMl: dayDrinkStats(events, dayStart).waterMl,
    });
  }
  return out;
}

// Consecutive days (ending today, or yesterday if today is still empty) that
// reached at least `goalMl` of water. This is the "green streak".
export function greenStreak(
  events: HydrationEvent[],
  now: number,
  goalMl: number
): number {
  const todayStart = startOfDay(now);
  let streak = 0;
  // Today only breaks the streak if it's empty; a partial today still counts
  // once it hits the goal, so we start from today and walk backwards.
  for (let i = 0; ; i++) {
    const dayStart = todayStart - i * DAY_MS;
    const { waterMl } = dayDrinkStats(events, dayStart);
    if (waterMl >= goalMl) {
      streak += 1;
    } else if (i === 0) {
      // Today not reached yet — don't break the run built on previous days.
      continue;
    } else {
      break;
    }
  }
  return streak;
}

// Share of the elapsed day spent in the green zone (sampled). Returns 0–100.
// Time-dependent (uses the engine), so callers pass an explicit `now`.
export function greenTimePctToday(
  events: HydrationEvent[],
  now: number,
  profile: UserProfile = DEFAULT_PROFILE,
  stepMs = 30 * 60_000
): number {
  const start = startOfDay(now);
  if (now <= start) return 100;
  let green = 0;
  let total = 0;
  for (let t = start; t <= now; t += stepMs) {
    total += 1;
    const s = computeState(events, t, profile);
    if (s.zone === 'green') green += 1;
  }
  return total === 0 ? 0 : Math.round((green / total) * 100);
}

// ————————— Poison time (the "less time poisoned" challenge) —————————

// Total milliseconds spent poisoned within [from, to). The bar is poisoned for
// POISON_WINDOW_MS after each alcohol event; overlapping windows (several drinks)
// count once, not double. Exact (interval union), no engine sampling needed.
export function poisonedMsInRange(
  events: HydrationEvent[],
  from: number,
  to: number
): number {
  if (to <= from) return 0;
  const windows: [number, number][] = [];
  for (const e of events) {
    if (e.type !== 'alcohol') continue;
    const s = Math.max(from, e.at);
    const en = Math.min(to, e.at + POISON_WINDOW_MS);
    if (en > s) windows.push([s, en]);
  }
  if (windows.length === 0) return 0;
  windows.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [curS, curE] = windows[0];
  for (let i = 1; i < windows.length; i++) {
    const [s, en] = windows[i];
    if (s > curE) {
      total += curE - curS;
      curS = s;
      curE = en;
    } else if (en > curE) {
      curE = en;
    }
  }
  total += curE - curS;
  return total;
}

// Poisoned time so far today, and over the rolling last 7 days.
export function poisonedMsToday(events: HydrationEvent[], now: number): number {
  return poisonedMsInRange(events, startOfDay(now), now);
}

export function poisonedMsThisWeek(
  events: HydrationEvent[],
  now: number,
  days = 7
): number {
  const from = startOfDay(now) - (days - 1) * DAY_MS;
  return poisonedMsInRange(events, from, now);
}

export interface DayPoison {
  dayStart: number;
  /** Voir `DayBar.weekday`. */
  weekday: number;
  poisonedMs: number;
}

// Poisoned ms for each of the last `count` days (today clipped to `now`).
export function lastNDaysPoisoned(
  events: HydrationEvent[],
  now: number,
  count = 7
): DayPoison[] {
  const todayStart = startOfDay(now);
  const out: DayPoison[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const dayStart = todayStart - i * DAY_MS;
    const end = Math.min(dayStart + DAY_MS, now);
    out.push({
      dayStart,
      weekday: new Date(dayStart).getDay(),
      poisonedMs: poisonedMsInRange(events, dayStart, end),
    });
  }
  return out;
}

// Consecutive days ending today with ZERO poisoned time — the "clean" streak.
// A drink today breaks it immediately (unlike the green streak's partial today).
// Bounded: we stop once we've walked back past the first recorded event (there
// is no history before that, so counting phantom clean days is meaningless) and
// hard-cap at `maxDays` so an all-clean history can never loop forever.
export function poisonFreeStreak(
  events: HydrationEvent[],
  now: number,
  maxDays = 366
): number {
  const todayStart = startOfDay(now);
  const earliestDay = events.length
    ? startOfDay(Math.min(...events.map((e) => e.at)))
    : todayStart;
  let streak = 0;
  for (let i = 0; i < maxDays; i++) {
    const dayStart = todayStart - i * DAY_MS;
    const end = i === 0 ? now : dayStart + DAY_MS;
    if (poisonedMsInRange(events, dayStart, end) !== 0) break;
    streak += 1;
    if (dayStart <= earliestDay) break; // no history before this — stop counting
  }
  return streak;
}

// ————————— Consumption recap (week / month roll-up) —————————

export interface ConsumptionRecap {
  waterMl: number; // water + electrolytes volume
  alcoholUnits: number; // number of alcohol drinks
  ethanolG: number; // total pure ethanol (grams)
  poisonedMs: number; // total time poisoned in the range
  poisonedDays: number; // days with any poison
  cleanDays: number; // days with zero poison
}

// Aggregate consumption over the last `days` (rolling, ending at `now`).
export function consumptionRecap(
  events: HydrationEvent[],
  now: number,
  days = 30
): ConsumptionRecap {
  const from = startOfDay(now) - (days - 1) * DAY_MS;
  let waterMl = 0;
  let alcoholUnits = 0;
  let ethanolG = 0;
  for (const e of events) {
    if (e.at < from || e.at > now) continue;
    if (e.type === 'water' || e.type === 'electrolytes') waterMl += e.volumeMl;
    if (e.type === 'alcohol') {
      alcoholUnits += 1;
      ethanolG += ethanolGrams(e.volumeMl, e.abv);
    }
  }
  let poisonedDays = 0;
  let cleanDays = 0;
  for (let i = 0; i < days; i++) {
    const dayStart = startOfDay(now) - i * DAY_MS;
    const end = Math.min(dayStart + DAY_MS, now);
    if (poisonedMsInRange(events, dayStart, end) > 0) poisonedDays += 1;
    else cleanDays += 1;
  }
  return {
    waterMl,
    alcoholUnits,
    ethanolG,
    poisonedMs: poisonedMsInRange(events, from, now),
    poisonedDays,
    cleanDays,
  };
}

// ————————— Lifetime totals (Snapchat-style "since install" counters) —————————

export interface LifetimeTotals {
  waterMl: number; // total water + electrolytes drunk, ever
  waterGlasses: number; // count of water/electrolyte drinks
  alcoholUnits: number; // count of alcohol drinks, ever
  ethanolG: number; // total pure ethanol (grams), ever
  sinceMs: number | null; // timestamp of the very first logged event
}

// Sum every logged drink across the whole history. This is the running "career"
// tally — it only ever grows, mirroring Snapchat's lifetime snap count.
export function lifetimeTotals(events: HydrationEvent[]): LifetimeTotals {
  let waterMl = 0;
  let waterGlasses = 0;
  let alcoholUnits = 0;
  let ethanolG = 0;
  let sinceMs: number | null = null;

  for (const e of events) {
    if (e.type === 'profile' || e.type === 'sport') continue;
    if (sinceMs == null || e.at < sinceMs) sinceMs = e.at;
    if (e.type === 'water' || e.type === 'electrolytes') {
      waterMl += e.volumeMl;
      waterGlasses += 1;
    } else if (e.type === 'alcohol') {
      alcoholUnits += 1;
      ethanolG += ethanolGrams(e.volumeMl, e.abv);
    }
  }
  return { waterMl, waterGlasses, alcoholUnits, ethanolG, sinceMs };
}
