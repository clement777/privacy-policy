// Physiological hydration engine — the differentiator of HYDRA.
// The bar represents mL of hydration relative to the user's daily need
// (weightKg × 32 mL). State is NEVER stored mutable: every call recomputes
// from the ordered event log + profile. Keeping the file pure and free of
// side-effects makes the Swift port in targets/widget/ trivially symmetric.

export type Sex = 'male' | 'female';
export type SportIntensity = 'light' | 'moderate' | 'intense';
export type Zone = 'green' | 'amber' | 'red' | 'poison';

export interface UserProfile {
  weightKg: number;
  sex: Sex;
  awakeHours: number;
  sleepStartHour: number;
  sleepEndHour: number;
  ambientTempC: number | null;    // null = 20°C reference (no penalty)
  relativeHumidityPct: number | null; // null = temperate reference (no penalty)
  altitudeM: number;
  dailyGoalOverrideMl: number | null; // let user pin a goal manually
  // First-run calibration from onboarding ("Comment tu te sens ?").
  // null = legacy / unknown → treat as 100 % (old behaviour).
  initialLevelPct: number | null;
}

/** Onboarding feeling → starting bar %. */
export const FEELING_LEVEL_PCT = {
  good: 55,
  ok: 35,
  dry: 20,
} as const;
export type FeelingKey = keyof typeof FEELING_LEVEL_PCT;

export const DEFAULT_PROFILE: UserProfile = {
  weightKg: 70,
  sex: 'male',
  awakeHours: 16,
  sleepStartHour: 23,
  sleepEndHour: 7,
  ambientTempC: null,
  relativeHumidityPct: null,
  altitudeM: 0,
  dailyGoalOverrideMl: null,
  initialLevelPct: null,
};

/** Resolved 0–100 starting fill. null / missing → 100 (backward compatible). */
export function resolveInitialLevelPct(p: UserProfile): number {
  const v = p.initialLevelPct;
  if (v == null || !Number.isFinite(v)) return 100;
  return Math.max(0, Math.min(100, v));
}

// One shape per event kind — no discriminant string in field names to keep
// the JSON compact for the App Group snapshot the widget reads.
export type HydrationEvent =
  | { type: 'water'; at: number; volumeMl: number }
  | { type: 'electrolytes'; at: number; volumeMl: number }
  | { type: 'alcohol'; at: number; volumeMl: number; abv: number }
  | { type: 'caffeine'; at: number; volumeMl: number; caffeineMg?: number }
  | { type: 'sport'; at: number; durationMin: number; intensity: SportIntensity }
  | { type: 'profile'; at: number; patch: Partial<UserProfile> };

export interface HydrationState {
  levelMl: number;
  dailyNeedMl: number;
  levelPct: number;
  zone: Zone;
  poisoned: boolean;
  poisonUntil: number | null;
  poisonMult: number;
  ambleAt: number | null;
  redAt: number | null;
  // Water absorbed (credited) in the trailing hour, and whether the body is
  // saturated — used to stop the user drinking faster than they can absorb.
  absorbedLastHourMl: number;
  absorbCapMl: number;
  saturated: boolean;
}

// ————————— Physio helpers —————————

// 32 mL/kg is the mid-band of the clinical 30–35 mL/kg guidance and matches
// EFSA-style adult recommendations once you factor in food water.
export const ML_PER_KG_DAY = 32;
export const ETHANOL_DENSITY_G_PER_ML = 0.789;
export const DIURESIS_ML_PER_G_ETHANOL = 10; // Eggleton constant (approx.)

// The body can only absorb / renally handle ~0.8–1.0 L of water per hour;
// beyond that the excess is simply excreted (and past ~1.5 L/h sustained it
// becomes a hyponatremia risk). We credit water intake up to this rolling
// hourly cap — drinking a litre at once does NOT hydrate faster than sipping.
// Sources: renal free-water clearance ~778–1043 mL/h (ADH suppressed);
// gastric emptying is not the bottleneck at normal volumes.
export const MAX_WATER_ABSORB_ML_PER_H = 1000;
export const ABSORB_WINDOW_MS = 3_600_000;

export function dailyNeedMl(p: UserProfile): number {
  return p.dailyGoalOverrideMl ?? p.weightKg * ML_PER_KG_DAY;
}

export function anchorLevelMl(p: UserProfile): number {
  return dailyNeedMl(p) * (resolveInitialLevelPct(p) / 100);
}

export function baseDrainMlPerHour(p: UserProfile): number {
  return dailyNeedMl(p) / p.awakeHours;
}

// Awake hours are fully determined by the sleep window, so we derive them
// rather than asking twice. Wraps around midnight; if start === end (no sleep
// window) the result is 24 h awake — consistent with isSleeping().
export function awakeHoursFromSleep(
  sleepStartHour: number,
  sleepEndHour: number
): number {
  const sleep = (sleepEndHour - sleepStartHour + 24) % 24;
  return 24 - sleep;
}

function tempMultiplier(tempC: number | null): number {
  if (tempC == null) return 1.0;
  if (tempC < 18) return 0.9;
  if (tempC < 25) return 1.0;
  if (tempC <= 30) return 1.2;
  return 1.4;
}

function altitudeMultiplier(altM: number): number {
  // > 2500 m adds ~3% baseline. Kept conservative — full model TODO.
  return altM > 2500 ? 1.03 : 1.0;
}

// ————————— Sweat model (metabolic-heat based) —————————
//
// The physiology (Cramer & Jay 2016, Gagnon & Kenny, Baker/GSSI 2017–2022):
// whole-body sweat rate is driven, above all, by the evaporative requirement
// for heat balance — i.e. metabolic heat production (Hprod), which scales with
// BODY MASS × exercise INTENSITY — then modulated by the environment. The
// classic "men sweat more" gap is mostly a body-mass artefact; at equal Hprod
// the intrinsic sex difference is small. So instead of fixed per-sex tiers, we
// compute sweat from mass × intensity and keep only a modest sex residual.

// Approximate metabolic cost (METs) of each effort category.
export const SPORT_METS: Record<SportIntensity, number> = {
  light: 4,
  moderate: 8,
  intense: 11.5,
};

// mL of sweat per (MET · kg · h). Calibrated so a 70 kg male at 8 METs in
// temperate conditions ≈ 800 mL/h (Baker/GSSI field average), while now
// scaling with mass and intensity. Derivation: metabolic power ≈ 1.22 W per
// MET·kg; ~80 % becomes heat; evaporating 1 g of sweat removes 2426 J, so
// mL/h ≈ W × 3600 / 2426 → 1.22 × 0.80 × 3600 / 2426 ≈ 1.43.
export const SWEAT_ML_PER_MET_KG_H = 1.43;

// Residual sex effect once body mass is accounted for (avoids double-counting
// the mass-driven gap). Females ~10 % lower at matched mass/intensity.
export const SWEAT_SEX_FACTOR_FEMALE = 0.9;

// Heat drives sweat harder than it drives passive drain, so this curve is
// steeper than tempMultiplier. null ≈ temperate (~20 °C) reference = 1.0.
function sweatTempMultiplier(tempC: number | null): number {
  if (tempC == null) return 1.0;
  if (tempC < 10) return 0.75;
  if (tempC < 18) return 0.9;
  if (tempC < 24) return 1.0;
  if (tempC < 28) return 1.15;
  if (tempC < 32) return 1.35;
  return 1.6;
}

// Above ~60 % RH evaporation is impaired, so the body over-produces sweat to
// try to shed heat → greater fluid loss. null = temperate reference = 1.0.
function humidityMultiplier(rh: number | null): number {
  if (rh == null) return 1.0;
  if (rh < 60) return 1.0;
  if (rh < 70) return 1.1;
  if (rh < 80) return 1.2;
  return 1.3;
}

export function sweatRateMlPerHour(
  p: UserProfile,
  intensity: SportIntensity
): number {
  const met = SPORT_METS[intensity];
  const sexFactor = p.sex === 'female' ? SWEAT_SEX_FACTOR_FEMALE : 1.0;
  const base = SWEAT_ML_PER_MET_KG_H * met * p.weightKg * sexFactor;
  return (
    base *
    sweatTempMultiplier(p.ambientTempC) *
    humidityMultiplier(p.relativeHumidityPct) *
    altitudeMultiplier(p.altitudeM)
  );
}

export function ethanolGrams(volumeMl: number, abv: number): number {
  return volumeMl * (abv / 100) * ETHANOL_DENSITY_G_PER_ML;
}

// ————————— Concentration factor (ABV gate) —————————

// The acute diuretic response is gated by the drink's alcohol *concentration*,
// not by total ethanol grams alone. Diet-controlled crossover trials matched a
// 30 g ethanol dose across beverages: beer (5%) produced NO measurable diuresis
// vs alcohol-free beer, while the same 30 g as wine (13.5%) or spirits DID — the
// effect switches on around ~13.5% ABV. So a shot must weigh more than a beer of
// equal grams. We ramp a factor from 0.3 (dilute, e.g. beer) to 1.0 (concentrated,
// ≥20%) and apply it to BOTH the net-water diuresis and the poison window.
// Sources: Polhuis et al. 2017 (Nutrients, weak vs strong beverages);
// Maughan et al. 2016 (Beverage Hydration Index — beer ≈ water).
export const CONC_ABV_LOW = 8; // ≤ this ABV: diuresis largely blunted (beer/cider)
export const CONC_ABV_HIGH = 20; // ≥ this ABV: full Eggleton diuresis (spirits)
export function concentrationFactor(abv: number): number {
  if (abv <= CONC_ABV_LOW) return 0.3;
  if (abv >= CONC_ABV_HIGH) return 1.0;
  return 0.3 + ((abv - CONC_ABV_LOW) / (CONC_ABV_HIGH - CONC_ABV_LOW)) * 0.7;
}

// ————————— Poison window model —————————

export const POISON_WINDOW_MS = 4 * 3600_000;
const POISON_PEAK_MS = 2 * 3600_000;

// Peak extra drain at the 2h apex. Driven by ethanol grams (≤10 g → 0.3,
// ≥30 g → 1.0) THEN scaled by the concentration gate, so a dilute drink barely
// poisons even at high grams (matches "1 L of beer ≠ dehydration", BHI 2016).
export function peakPoisonExtra(ethanolG: number, abv: number): number {
  const g = Math.max(10, Math.min(30, ethanolG));
  const gramsCurve = 0.3 + ((g - 10) / 20) * 0.7;
  return gramsCurve * concentrationFactor(abv);
}

// Triangular envelope: 0 at eventAt, peakExtra at eventAt+2h, 0 at
// eventAt+4h. Any earlier or later contributes nothing.
function poisonExtraFromEvent(
  eventAt: number,
  ethanolG: number,
  abv: number,
  t: number
): number {
  const dt = t - eventAt;
  if (dt < 0 || dt > POISON_WINDOW_MS) return 0;
  const peakExtra = peakPoisonExtra(ethanolG, abv);
  const rise = dt / POISON_PEAK_MS;                              // 0→1 over first 2h
  const fall = (POISON_WINDOW_MS - dt) / POISON_PEAK_MS;         // 1→0 over last 2h
  return peakExtra * Math.min(rise, fall);
}

// Cumulative multiplier across all still-active alcohol events, capped ×3.
function poisonMultiplierAt(events: HydrationEvent[], t: number): number {
  let extra = 0;
  for (const e of events) {
    if (e.type !== 'alcohol') continue;
    if (t < e.at || t > e.at + POISON_WINDOW_MS) continue;
    extra += poisonExtraFromEvent(e.at, ethanolGrams(e.volumeMl, e.abv), e.abv, t);
  }
  return Math.min(3.0, 1.0 + extra);
}

function poisonEndsAt(events: HydrationEvent[], now: number): number | null {
  let end: number | null = null;
  for (const e of events) {
    if (e.type !== 'alcohol') continue;
    const windowEnd = e.at + POISON_WINDOW_MS;
    if (now <= windowEnd) end = end == null ? windowEnd : Math.max(end, windowEnd);
  }
  return end;
}

// ————————— Sleep window —————————

function isSleeping(at: number, p: UserProfile): boolean {
  const d = new Date(at);
  const h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  const { sleepStartHour: a, sleepEndHour: b } = p;
  if (a === b) return false;
  return a < b ? h >= a && h < b : h >= a || h < b;
}

const SLEEP_MULTIPLIER = 0.4;

// ————————— Profile effective at time t —————————

function effectiveProfile(
  events: HydrationEvent[],
  at: number,
  base: UserProfile
): UserProfile {
  let p = { ...base };
  for (const e of events) {
    if (e.at > at) break;
    if (e.type === 'profile') p = { ...p, ...e.patch };
  }
  return p;
}

// ————————— Derived event data (cached per event-array identity) —————————
//
// The integrator samples minute by minute from the first event to `now`. It
// used to re-scan the FULL event list three times per step (profile / alcohol /
// sport), re-sort on every call, and recompute the O(n²) absorption credits
// twice — so cost grew with (days of history × total events) and the app got
// measurably slower every single day it was used.
//
// Everything below depends only on the event list, never on `at`, so it is
// derived once and cached against the array's identity. The store hands out a
// new array only when events actually change, so live re-renders all hit the
// cache. Semantics are unchanged — this is purely avoided repeated work.

interface Derived {
  sorted: HydrationEvent[];
  profileEvts: { at: number; patch: Partial<UserProfile> }[];
  /** Alcohol events with their poison peak precomputed. */
  alcohol: { at: number; peak: number }[];
  sport: { at: number; endAt: number; intensity: SportIntensity }[];
  credited: number[];
  /**
   * Results already computed for this exact event list, keyed by timestamp.
   * The stats screen samples the same fixed instants (start of day + k·30 min)
   * on every render, and the home screen re-asks for timestamps it has just
   * asked for — both are near-total cache hits. Bounded, and dropped whenever
   * the base profile changes since results depend on it.
   */
  memo: Map<number, HydrationState>;
  memoProfile: UserProfile | null;
}

const MEMO_MAX = 512;

const derivedCache = new WeakMap<HydrationEvent[], Derived>();

function derive(events: HydrationEvent[]): Derived {
  const hit = derivedCache.get(events);
  if (hit) return hit;

  const sorted = [...events].sort((a, b) => a.at - b.at);
  const profileEvts: Derived['profileEvts'] = [];
  const alcohol: Derived['alcohol'] = [];
  const sport: Derived['sport'] = [];
  for (const e of sorted) {
    if (e.type === 'profile') {
      profileEvts.push({ at: e.at, patch: e.patch });
    } else if (e.type === 'alcohol') {
      alcohol.push({
        at: e.at,
        peak: peakPoisonExtra(ethanolGrams(e.volumeMl, e.abv), e.abv),
      });
    } else if (e.type === 'sport') {
      sport.push({
        at: e.at,
        endAt: e.at + e.durationMin * 60_000,
        intensity: e.intensity,
      });
    }
  }

  const d: Derived = {
    sorted,
    profileEvts,
    alcohol,
    sport,
    credited: creditedWaterMl(sorted),
    memo: new Map(),
    memoProfile: null,
  };
  derivedCache.set(events, d);
  return d;
}

// Poison multiplier from the pre-extracted alcohol list (sorted ascending, so
// we can stop as soon as an event is in the future).
function poisonMultFrom(alcohol: Derived['alcohol'], t: number): number {
  let extra = 0;
  for (const a of alcohol) {
    if (a.at > t) break;
    const dt = t - a.at;
    if (dt > POISON_WINDOW_MS) continue;
    const rise = dt / POISON_PEAK_MS;
    const fall = (POISON_WINDOW_MS - dt) / POISON_PEAK_MS;
    extra += a.peak * Math.min(rise, fall);
  }
  return Math.min(3.0, 1.0 + extra);
}

function sportLossFrom(
  sport: Derived['sport'],
  t0: number,
  t1: number,
  p: UserProfile
): number {
  let loss = 0;
  for (const e of sport) {
    if (e.at >= t1) break;
    const s = Math.max(e.at, t0);
    const en = Math.min(e.endAt, t1);
    if (en <= s) continue;
    loss += (sweatRateMlPerHour(p, e.intensity) * (en - s)) / 3600_000;
  }
  return loss;
}

// ————————— Integrator —————————

const STEP_MS = 60_000; // 1-min sampling — accurate enough over 6h horizon.

// Base drain per ms at midpoint, given profile + poison + sleep.
function drainMlPerMs(p: UserProfile, poisonMult: number, sleeping: boolean): number {
  let mult = 1.0;
  mult *= tempMultiplier(p.ambientTempC);
  mult *= altitudeMultiplier(p.altitudeM);
  mult *= poisonMult;
  if (sleeping) mult *= SLEEP_MULTIPLIER;
  return (baseDrainMlPerHour(p) * mult) / 3600_000;
}

// Sweat loss produced by any sport event whose window intersects [t0, t1].
function sportLossMlOver(
  events: HydrationEvent[],
  t0: number,
  t1: number,
  p: UserProfile
): number {
  let loss = 0;
  for (const e of events) {
    if (e.type !== 'sport') continue;
    const endAt = e.at + e.durationMin * 60_000;
    const s = Math.max(e.at, t0);
    const en = Math.min(endAt, t1);
    if (en <= s) continue;
    loss += (sweatRateMlPerHour(p, e.intensity) * (en - s)) / 3600_000;
  }
  return loss;
}

// Integrate total mL lost between `from` and `to`.
// Time only moves forward, so the profile is carried across steps behind a
// pointer and rebuilt solely when a profile event is actually crossed —
// instead of re-deriving it from the whole event list on every minute.
function integrateLoss(
  d: Derived,
  from: number,
  to: number,
  baseProfile: UserProfile
): number {
  if (to <= from) return 0;
  let acc = 0;
  let t = from;

  let pi = 0;
  let p: UserProfile = baseProfile;
  const applyProfilesUpTo = (at: number) => {
    while (pi < d.profileEvts.length && d.profileEvts[pi].at <= at) {
      p = { ...p, ...d.profileEvts[pi].patch };
      pi++;
    }
  };
  applyProfilesUpTo(from);

  while (t < to) {
    const next = Math.min(t + STEP_MS, to);
    const mid = (t + next) / 2;
    applyProfilesUpTo(mid);
    const poison = poisonMultFrom(d.alcohol, mid);
    acc += drainMlPerMs(p, poison, isSleeping(mid, p)) * (next - t);
    if (d.sport.length > 0) acc += sportLossFrom(d.sport, t, next, p);
    t = next;
  }
  return acc;
}

// ————————— Zone classification —————————

export function zoneOf(pct: number, poisoned: boolean): Zone {
  if (poisoned) return 'poison';
  if (pct > 55) return 'green';
  if (pct >= 25) return 'amber';
  return 'red';
}

/** Integer % for UI (app + widgets). Always round-half-up so both surfaces match. */
export function displayLevelPct(levelPct: number): number {
  if (!Number.isFinite(levelPct)) return 0;
  return Math.max(0, Math.min(100, Math.round(levelPct)));
}

// ————————— Instantaneous drink impact (mL) —————————

// Alcohol diuresis (excretion). Gated by concentration (see concentrationFactor):
// a dilute drink like beer barely triggers extra urine, spirits carry the full
// Eggleton loss. This is an *excretion* effect, so it is NOT limited by the
// gastric/renal absorption cap — it always applies in full.
export function alcoholDiuresisMl(volumeMl: number, abv: number): number {
  return (
    ethanolGrams(volumeMl, abv) *
    DIURESIS_ML_PER_G_ETHANOL *
    concentrationFactor(abv)
  );
}

// Alcohol Layer A: honest net water balance for a SINGLE drink in isolation
// (uncapped water). The water in the drink is subject to the hourly absorption
// cap in the real timeline (see creditedWaterMl / applyEventImpact); this helper
// is the reference value when absorption capacity is available.
export function alcoholNetMl(volumeMl: number, abv: number): number {
  const waterInDrink = volumeMl * (1 - abv / 100);
  return waterInDrink - alcoholDiuresisMl(volumeMl, abv);
}

function caffeineNetMl(e: Extract<HydrationEvent, { type: 'caffeine' }>): number {
  const mg = e.caffeineMg ?? 90;
  // MVP: treat < 500 mg as net water; 500+ mg costs ~250 mL over 3h — we
  // apply the loss as a single instantaneous debit for now (TODO: distribute).
  if (mg >= 500) return e.volumeMl - 250;
  return e.volumeMl;
}

// Fluid volume an event puts into the gut, competing for absorption capacity.
// Alcohol counts by its WATER content (the ethanol fraction isn't hydration):
// a litre of wine floods the gut with water just like a litre of water, so it
// hits the same ~1 L/h absorption ceiling.
function fluidIntakeMl(e: HydrationEvent): number {
  if (e.type === 'water' || e.type === 'electrolytes') return e.volumeMl;
  if (e.type === 'alcohol') return e.volumeMl * (1 - e.abv / 100);
  return 0;
}

// Credit each fluid event (water, electrolytes, AND alcohol's water) only up to
// the rolling hourly absorption cap. Returns an array parallel to `sorted`: the
// mL that actually count toward the bar (0 for non-fluid events). Fluid drunk
// past the cap within the trailing hour is "overflow" — excreted, not stored.
export function creditedWaterMl(sorted: HydrationEvent[]): number[] {
  const credited: number[] = new Array(sorted.length).fill(0);
  // Sliding window over the trailing hour instead of re-summing the whole
  // history for every event (was O(n²) — the dominant cost once a user had a
  // few hundred events, and it ran twice per computeState call).
  const win: { at: number; credited: number }[] = [];
  let used = 0;
  let head = 0;
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    const intake = fluidIntakeMl(e);
    if (intake <= 0) continue;
    while (head < win.length && win[head].at <= e.at - ABSORB_WINDOW_MS) {
      used -= win[head].credited;
      head++;
    }
    const remaining = Math.max(0, MAX_WATER_ABSORB_ML_PER_H - used);
    const cred = Math.min(intake, remaining);
    credited[i] = cred;
    if (cred > 0) {
      win.push({ at: e.at, credited: cred });
      used += cred;
    }
  }
  return credited;
}

// How much fluid (credited) has been absorbed in the hour ending at `at`.
export function waterAbsorbedInWindow(sorted: HydrationEvent[], at: number): number {
  return absorbedInWindowFrom(derive(sorted), at);
}

function absorbedInWindowFrom(d: Derived, at: number): number {
  const { sorted, credited } = d;
  let used = 0;
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    if (e.at > at) break;
    if (e.at > at - ABSORB_WINDOW_MS) used += credited[i];
  }
  return used;
}

function applyEventImpact(
  event: HydrationEvent,
  levelMl: number,
  cap: number,
  creditedMl: number
): number {
  switch (event.type) {
    case 'water':
      return clamp(levelMl + creditedMl, 0, cap);
    case 'electrolytes':
      return clamp(levelMl + creditedMl * 1.1, 0, cap);
    case 'alcohol':
      // Absorbed water (creditedMl, capped by the hourly limit) minus the full
      // diuresis. Once the absorption cap is saturated creditedMl → 0, so extra
      // drinks only carry their diuretic loss: bingeing can push net negative.
      return clamp(
        levelMl + creditedMl - alcoholDiuresisMl(event.volumeMl, event.abv),
        0,
        cap
      );
    case 'caffeine':
      return clamp(levelMl + caffeineNetMl(event), 0, cap);
    case 'sport':
    case 'profile':
      return levelMl; // sport is applied via the integrator; profile has no direct impact
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// ————————— Public: compute state at `at` —————————

export function computeState(
  events: HydrationEvent[],
  at: number,
  baseProfile: UserProfile = DEFAULT_PROFILE
): HydrationState {
  const d = derive(events);
  if (d.memoProfile !== baseProfile) {
    d.memo.clear();
    d.memoProfile = baseProfile;
  }
  const cached = d.memo.get(at);
  if (cached) return cached;

  const sorted = d.sorted;
  const profileAtNow = effectiveProfile(sorted, at, baseProfile);
  const capNow = dailyNeedMl(profileAtNow);

  if (sorted.length === 0) {
    // Use the declared % directly (avoids float noise around the 55 % amber edge).
    const levelPct = resolveInitialLevelPct(profileAtNow);
    const levelMl = clamp((capNow * levelPct) / 100, 0, capNow);
    return memoize(d, at, {
      levelMl,
      dailyNeedMl: capNow,
      levelPct,
      zone: zoneOf(levelPct, false),
      poisoned: false,
      poisonUntil: null,
      poisonMult: 1,
      ambleAt: null,
      redAt: null,
      absorbedLastHourMl: 0,
      absorbCapMl: MAX_WATER_ABSORB_ML_PER_H,
      saturated: false,
    });
  }

  // Per-event credited water (rolling hourly absorption cap) — from cache.
  const credited = d.credited;

  // Anchor: onboarding calibration (or 100 % legacy) at the first event's timestamp.
  const startProfile = effectiveProfile(sorted, sorted[0].at, baseProfile);
  let levelMl = anchorLevelMl(startProfile);
  let cursor = sorted[0].at;

  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    levelMl -= integrateLoss(d, cursor, e.at, baseProfile);
    const p = effectiveProfile(sorted, e.at, baseProfile);
    levelMl = applyEventImpact(e, levelMl, dailyNeedMl(p), credited[i]);
    cursor = e.at;
  }
  levelMl -= integrateLoss(d, cursor, at, baseProfile);
  levelMl = clamp(levelMl, 0, capNow);

  const poisonMult = poisonMultFrom(d.alcohol, at);
  const poisoned = poisonMult > 1.0;
  const poisonUntil = poisoned ? poisonEndsAt(sorted, at) : null;
  const levelPct = (levelMl / capNow) * 100;
  const zone = zoneOf(levelPct, poisoned);
  const { ambleAt, redAt } = forecastFrom(d, at, levelMl, baseProfile);

  const absorbedLastHourMl = absorbedInWindowFrom(d, at);
  const saturated = absorbedLastHourMl >= MAX_WATER_ABSORB_ML_PER_H * 0.98;

  return memoize(d, at, {
    levelMl,
    dailyNeedMl: capNow,
    levelPct,
    zone,
    poisoned,
    poisonUntil,
    poisonMult,
    ambleAt,
    redAt,
    absorbedLastHourMl,
    absorbCapMl: MAX_WATER_ABSORB_ML_PER_H,
    saturated,
  });
}

function memoize(d: Derived, at: number, s: HydrationState): HydrationState {
  // Timestamps only ever move forward, so an overflowing map is stale by
  // definition — clearing wholesale is cheaper than tracking an LRU.
  if (d.memo.size >= MEMO_MAX) d.memo.clear();
  d.memo.set(at, s);
  return s;
}

// ————————— Forecast when we hit amber / red next —————————

export function forecastZoneCrossings(
  events: HydrationEvent[],
  fromAt: number,
  startLevelMl: number,
  baseProfile: UserProfile,
  horizonMs: number = 6 * 3600_000
): { ambleAt: number | null; redAt: number | null } {
  return forecastFrom(derive(events), fromAt, startLevelMl, baseProfile, horizonMs);
}

function forecastFrom(
  d: Derived,
  fromAt: number,
  startLevelMl: number,
  baseProfile: UserProfile,
  horizonMs: number = 6 * 3600_000
): { ambleAt: number | null; redAt: number | null } {
  const profileNow = effectiveProfile(d.sorted, fromAt, baseProfile);
  const cap = dailyNeedMl(profileNow);
  const amberThresh = cap * 0.55;
  const redThresh = cap * 0.25;

  let ambleAt: number | null = startLevelMl <= amberThresh ? fromAt : null;
  let redAt: number | null = startLevelMl < redThresh ? fromAt : null;
  if (ambleAt != null && redAt != null) return { ambleAt, redAt };

  let level = startLevelMl;
  let t = fromAt;
  const end = fromAt + horizonMs;

  let pi = 0;
  let p: UserProfile = baseProfile;
  const applyProfilesUpTo = (upTo: number) => {
    while (pi < d.profileEvts.length && d.profileEvts[pi].at <= upTo) {
      p = { ...p, ...d.profileEvts[pi].patch };
      pi++;
    }
  };
  applyProfilesUpTo(fromAt);

  while (t < end) {
    const next = Math.min(t + STEP_MS, end);
    const dt = next - t;
    const mid = (t + next) / 2;
    applyProfilesUpTo(mid);
    const poison = poisonMultFrom(d.alcohol, mid);
    const before = level;
    const loss =
      drainMlPerMs(p, poison, isSleeping(mid, p)) * dt +
      (d.sport.length > 0 ? sportLossFrom(d.sport, t, next, p) : 0);
    const after = before - loss;
    // Linearly interpolate the crossing WITHIN this step so the returned
    // timestamp is second-precise — otherwise the live countdown would be
    // quantized to whole minutes (seconds stuck at 00) since it recomputes
    // every tick from `now`.
    if (ambleAt == null && after <= amberThresh) {
      const frac = loss > 0 ? (before - amberThresh) / loss : 0;
      ambleAt = t + frac * dt;
    }
    if (redAt == null && after < redThresh) {
      const frac = loss > 0 ? (before - redThresh) / loss : 0;
      redAt = t + frac * dt;
      break;
    }
    level = after;
    t = next;
  }
  return { ambleAt, redAt };
}

// Convenience wrapper.
export function stateNow(
  events: HydrationEvent[],
  profile?: UserProfile
): HydrationState {
  return computeState(events, Date.now(), profile);
}

// ————————— Preset drinks (editable in Settings) —————————

export interface DrinkPreset {
  key: string;
  label: string;
  kind: 'water' | 'electrolytes' | 'alcohol' | 'caffeine';
  volumeMl: number;
  abv?: number;
  caffeineMg?: number;
}

export const DEFAULT_PRESETS: DrinkPreset[] = [
  { key: 'water', label: 'EAU', kind: 'water', volumeMl: 250 },
  { key: 'water_bottle', label: 'BOUTEILLE', kind: 'water', volumeMl: 500 },
  { key: 'electrolytes', label: 'ÉLECTROLYTES', kind: 'electrolytes', volumeMl: 500 },
  // Alcohol grouped into three tiers by ABV range so a single tap covers a
  // whole family of drinks. Each carries a representative volume + ABV used by
  // the two-layer alcohol model. Ranges shown on the buttons.
  { key: 'alcohol_light', label: 'ALCOOL LÉGER', kind: 'alcohol', volumeMl: 400, abv: 5 },   // 2–8°  bière, cidre
  { key: 'alcohol_medium', label: 'ALCOOL MOYEN', kind: 'alcohol', volumeMl: 150, abv: 14 }, // 9–22° vin, cocktail
  { key: 'alcohol_strong', label: 'ALCOOL FORT', kind: 'alcohol', volumeMl: 40, abv: 40 },   // 30–45° spiritueux
  { key: 'coffee', label: 'CAFÉ', kind: 'caffeine', volumeMl: 100, caffeineMg: 90 },
];

// How much more water (mL) can still be usefully absorbed right now — used by
// the app to stop the user drinking faster than their body can handle.
export function remainingAbsorptionMl(
  events: HydrationEvent[],
  at: number = Date.now()
): number {
  // On the drink-tap path — goes through the cache rather than re-sorting and
  // re-crediting the whole history on every button press.
  const used = absorbedInWindowFrom(derive(events), at);
  return Math.max(0, MAX_WATER_ABSORB_ML_PER_H - used);
}

// Smallest amount of free absorption capacity (mL) the app requires before it
// will accept another drink. Mirrors the store's guard (logWater / logPreset
// refuse a drink when remainingAbsorptionMl < this). Kept here so the "you can
// drink again in …" countdown and the block use the exact same threshold.
export const MIN_DRINKABLE_ML = 30;

// When will the body accept water again? The absorption cap is a *rolling* hour:
// each credited drink frees its capacity exactly ABSORB_WINDOW_MS after it was
// logged. With no new drinks the credited amounts are fixed, so we replay the
// oldest-first exit events until enough capacity returns, and report the instant
// it does. Returns the absolute timestamp (ms), or null if there's room already.
export function absorptionRecoveryAt(
  events: HydrationEvent[],
  at: number = Date.now(),
  minRemainingMl: number = MIN_DRINKABLE_ML
): number | null {
  const { sorted, credited } = derive(events);
  // Credited contributions still inside the trailing-hour window, each tagged
  // with the instant it leaves the window (its timestamp + one hour).
  const inWindow: { exitAt: number; ml: number }[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    if (credited[i] > 0 && e.at > at - ABSORB_WINDOW_MS && e.at <= at) {
      inWindow.push({ exitAt: e.at + ABSORB_WINDOW_MS, ml: credited[i] });
    }
  }
  let used = inWindow.reduce((sum, x) => sum + x.ml, 0);
  if (MAX_WATER_ABSORB_ML_PER_H - used >= minRemainingMl) return null; // room now
  inWindow.sort((a, b) => a.exitAt - b.exitAt); // oldest leaves first
  for (const x of inWindow) {
    used -= x.ml;
    if (MAX_WATER_ABSORB_ML_PER_H - used >= minRemainingMl) return x.exitAt;
  }
  return null;
}
