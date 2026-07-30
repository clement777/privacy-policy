import Foundation

// Strict port of src/engine/hydrationEngine.ts (v2 physiological model).
// Any change to the TS source of truth MUST land here in the same commit.
// The port is guarded by src/engine/__parity__/ — swiftReplica.ts is a
// transliteration of this file and swiftParity.test.ts diffs it against the TS
// engine, so a change made here without one there fails CI. Keep the two in step.

enum Sex: String, Codable { case male, female }
enum SportIntensity: String, Codable { case light, moderate, intense }
enum Zone: String { case green, amber, red, poison }

enum EventType: String, Codable {
    case water, electrolytes, alcohol, caffeine, sport, profile
}

struct UserProfile: Codable {
    var weightKg: Double
    var sex: Sex
    var awakeHours: Double
    var sleepStartHour: Double
    var sleepEndHour: Double
    var ambientTempC: Double?
    var relativeHumidityPct: Double?
    var altitudeM: Double
    var dailyGoalOverrideMl: Double?
    /// First-run calibration from onboarding. nil = legacy → 100 %.
    var initialLevelPct: Double?

    static let `default` = UserProfile(
        weightKg: 70,
        sex: .male,
        awakeHours: 16,
        sleepStartHour: 23,
        sleepEndHour: 7,
        ambientTempC: nil,
        relativeHumidityPct: nil,
        altitudeM: 0,
        dailyGoalOverrideMl: nil,
        initialLevelPct: nil
    )
}

// Mirrors the TS `Partial<UserProfile>` carried by a `profile` event: EVERY
// field is optional. The app writes single-field patches (e.g. `{weightKg:75}`
// when you change your weight), so decoding a patch into the full `UserProfile`
// throws `keyNotFound` and takes the WHOLE snapshot decode down with it — which
// is why the widget silently fell back to its 100% placeholder. For the three
// nullable UserProfile fields we track key-presence so a re-encode (the widget's
// +EAU button rewrites the snapshot) round-trips exactly, and so effectiveProfile
// can mirror the TS `{...p, ...patch}` spread (only keys the patch contains win).
struct ProfilePatch: Codable {
    var weightKg: Double?
    var sex: Sex?
    var awakeHours: Double?
    var sleepStartHour: Double?
    var sleepEndHour: Double?
    var altitudeM: Double?
    var hasAmbientTempC = false;        var ambientTempC: Double?
    var hasRelativeHumidityPct = false; var relativeHumidityPct: Double?
    var hasDailyGoalOverrideMl = false; var dailyGoalOverrideMl: Double?
    var hasInitialLevelPct = false;     var initialLevelPct: Double?

    enum CodingKeys: String, CodingKey {
        case weightKg, sex, awakeHours, sleepStartHour, sleepEndHour, altitudeM
        case ambientTempC, relativeHumidityPct, dailyGoalOverrideMl, initialLevelPct
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        weightKg = try c.decodeIfPresent(Double.self, forKey: .weightKg)
        sex = try c.decodeIfPresent(Sex.self, forKey: .sex)
        awakeHours = try c.decodeIfPresent(Double.self, forKey: .awakeHours)
        sleepStartHour = try c.decodeIfPresent(Double.self, forKey: .sleepStartHour)
        sleepEndHour = try c.decodeIfPresent(Double.self, forKey: .sleepEndHour)
        altitudeM = try c.decodeIfPresent(Double.self, forKey: .altitudeM)
        if c.contains(.ambientTempC) {
            hasAmbientTempC = true
            ambientTempC = try c.decodeIfPresent(Double.self, forKey: .ambientTempC)
        }
        if c.contains(.relativeHumidityPct) {
            hasRelativeHumidityPct = true
            relativeHumidityPct = try c.decodeIfPresent(Double.self, forKey: .relativeHumidityPct)
        }
        if c.contains(.dailyGoalOverrideMl) {
            hasDailyGoalOverrideMl = true
            dailyGoalOverrideMl = try c.decodeIfPresent(Double.self, forKey: .dailyGoalOverrideMl)
        }
        if c.contains(.initialLevelPct) {
            hasInitialLevelPct = true
            initialLevelPct = try c.decodeIfPresent(Double.self, forKey: .initialLevelPct)
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(weightKg, forKey: .weightKg)
        try c.encodeIfPresent(sex, forKey: .sex)
        try c.encodeIfPresent(awakeHours, forKey: .awakeHours)
        try c.encodeIfPresent(sleepStartHour, forKey: .sleepStartHour)
        try c.encodeIfPresent(sleepEndHour, forKey: .sleepEndHour)
        try c.encodeIfPresent(altitudeM, forKey: .altitudeM)
        // encode (not encodeIfPresent) so an explicit null is preserved, matching
        // how the app wrote it; the presence flag decides whether to emit at all.
        if hasAmbientTempC { try c.encode(ambientTempC, forKey: .ambientTempC) }
        if hasRelativeHumidityPct { try c.encode(relativeHumidityPct, forKey: .relativeHumidityPct) }
        if hasDailyGoalOverrideMl { try c.encode(dailyGoalOverrideMl, forKey: .dailyGoalOverrideMl) }
        if hasInitialLevelPct { try c.encode(initialLevelPct, forKey: .initialLevelPct) }
    }
}

struct HydrationEvent: Codable {
    let type: EventType
    let at: TimeInterval          // ms since epoch (JS parity)
    let volumeMl: Double?
    let abv: Double?
    let caffeineMg: Double?
    let durationMin: Double?
    let intensity: SportIntensity?
    let patch: ProfilePatch?
}

struct HydrationState {
    var levelMl: Double
    var dailyNeedMl: Double
    var levelPct: Double
    var zone: Zone
    var poisoned: Bool
    var poisonUntil: TimeInterval?
    var poisonMult: Double
    var ambleAt: TimeInterval?
    var redAt: TimeInterval?
    var absorbedLastHourMl: Double
    var absorbCapMl: Double
    var saturated: Bool
}

// ————————— Physio constants —————————

let ML_PER_KG_DAY: Double = 32
let ETHANOL_DENSITY_G_PER_ML: Double = 0.789
let DIURESIS_ML_PER_G_ETHANOL: Double = 10
let POISON_WINDOW_MS: Double = 4 * 3_600_000
let POISON_PEAK_MS: Double = 2 * 3_600_000
let SLEEP_MULTIPLIER: Double = 0.4
let STEP_MS: Double = 60_000
// See TS engine: body absorbs / renally handles ~1 L water per rolling hour.
let MAX_WATER_ABSORB_ML_PER_H: Double = 1000
let ABSORB_WINDOW_MS: Double = 3_600_000

func dailyNeedMl(_ p: UserProfile) -> Double {
    if let g = p.dailyGoalOverrideMl { return g }
    return p.weightKg * ML_PER_KG_DAY
}

func resolveInitialLevelPct(_ p: UserProfile) -> Double {
    guard let v = p.initialLevelPct, v.isFinite else { return 100 }
    return max(0, min(100, v))
}

func anchorLevelMl(_ p: UserProfile) -> Double {
    return dailyNeedMl(p) * (resolveInitialLevelPct(p) / 100)
}

func baseDrainMlPerHour(_ p: UserProfile) -> Double {
    return dailyNeedMl(p) / p.awakeHours
}

// Awake hours derive from the sleep window (see TS engine).
func awakeHoursFromSleep(_ sleepStartHour: Double, _ sleepEndHour: Double) -> Double {
    let sleep = (sleepEndHour - sleepStartHour + 24).truncatingRemainder(dividingBy: 24)
    return 24 - sleep
}

private func tempMultiplier(_ tempC: Double?) -> Double {
    guard let t = tempC else { return 1.0 }
    if t < 18 { return 0.9 }
    if t < 25 { return 1.0 }
    if t <= 30 { return 1.2 }
    return 1.4
}

private func altitudeMultiplier(_ altM: Double) -> Double {
    return altM > 2500 ? 1.03 : 1.0
}

// ————————— Sweat model (metabolic-heat based) — mirrors TS engine —————————
// WBSR is driven by metabolic heat (body mass × intensity) then modulated by
// the environment; the sex gap is mostly mass-driven, so only a small residual
// sex factor remains. See src/engine/hydrationEngine.ts for the derivation.

let SPORT_METS: [SportIntensity: Double] = [
    .light: 4,
    .moderate: 8,
    .intense: 11.5,
]
let SWEAT_ML_PER_MET_KG_H: Double = 1.43
let SWEAT_SEX_FACTOR_FEMALE: Double = 0.9

private func sweatTempMultiplier(_ tempC: Double?) -> Double {
    guard let t = tempC else { return 1.0 }
    if t < 10 { return 0.75 }
    if t < 18 { return 0.9 }
    if t < 24 { return 1.0 }
    if t < 28 { return 1.15 }
    if t < 32 { return 1.35 }
    return 1.6
}

private func humidityMultiplier(_ rh: Double?) -> Double {
    guard let h = rh else { return 1.0 }
    if h < 60 { return 1.0 }
    if h < 70 { return 1.1 }
    if h < 80 { return 1.2 }
    return 1.3
}

func sweatRateMlPerHour(_ p: UserProfile, intensity: SportIntensity) -> Double {
    let met = SPORT_METS[intensity] ?? 8
    let sexFactor = p.sex == .female ? SWEAT_SEX_FACTOR_FEMALE : 1.0
    let base = SWEAT_ML_PER_MET_KG_H * met * p.weightKg * sexFactor
    return base
        * sweatTempMultiplier(p.ambientTempC)
        * humidityMultiplier(p.relativeHumidityPct)
        * altitudeMultiplier(p.altitudeM)
}

func ethanolGrams(volumeMl: Double, abv: Double) -> Double {
    return volumeMl * (abv / 100) * ETHANOL_DENSITY_G_PER_ML
}

// Concentration gate — mirrors TS concentrationFactor. The acute diuretic /
// poison response depends on the drink's ABV, not just total ethanol grams: a
// 30 g dose as beer (5%) triggers no measurable diuresis, the same 30 g as wine
// (13.5%) or spirits does. Ramp 0.3 (dilute) → 1.0 (≥20%). See TS engine for
// sources (Polhuis 2017, Maughan 2016).
let CONC_ABV_LOW: Double = 8
let CONC_ABV_HIGH: Double = 20
func concentrationFactor(_ abv: Double) -> Double {
    if abv <= CONC_ABV_LOW { return 0.3 }
    if abv >= CONC_ABV_HIGH { return 1.0 }
    return 0.3 + ((abv - CONC_ABV_LOW) / (CONC_ABV_HIGH - CONC_ABV_LOW)) * 0.7
}

func peakPoisonExtra(_ ethanolG: Double, _ abv: Double) -> Double {
    let g = min(30, max(10, ethanolG))
    let gramsCurve = 0.3 + ((g - 10) / 20) * 0.7
    return gramsCurve * concentrationFactor(abv)
}

private func poisonExtraFromEvent(_ eventAt: TimeInterval, _ ethanolG: Double, _ abv: Double, _ t: TimeInterval) -> Double {
    let dt = t - eventAt
    if dt < 0 || dt > POISON_WINDOW_MS { return 0 }
    let peakExtra = peakPoisonExtra(ethanolG, abv)
    let rise = dt / POISON_PEAK_MS
    let fall = (POISON_WINDOW_MS - dt) / POISON_PEAK_MS
    return peakExtra * min(rise, fall)
}

private func poisonEndsAt(_ events: [HydrationEvent], _ now: TimeInterval) -> TimeInterval? {
    var end: TimeInterval? = nil
    for e in events where e.type == .alcohol {
        let we = e.at + POISON_WINDOW_MS
        if now <= we { end = end == nil ? we : max(end!, we) }
    }
    return end
}

// ————————— Local hour-of-day (no Calendar) —————————
//
// The integrator asks "is the user asleep?" once per MINUTE of history, and the
// old implementation answered it with `Calendar.current.dateComponents`, which
// allocates a DateComponents and goes through the locale machinery every time.
// On a month of history that is ~43 000 Calendar round-trips PER computed state,
// and the widget computes ~120 states per timeline — it was the single largest
// cost in the extension. The UTC offset only moves on a DST boundary, so we
// resolve it once per calendar day and reuse it across the whole walk (time only
// ever moves forward here, so a one-slot cache is enough).
struct TZOffsetCache {
    private var lastDay: Int = .min
    private var offsetSec: Double = 0

    mutating func offset(atMs ms: TimeInterval) -> Double {
        let day = Int((ms / 86_400_000).rounded(.down))
        if day != lastDay {
            lastDay = day
            offsetSec = Double(TimeZone.current.secondsFromGMT(
                for: Date(timeIntervalSince1970: ms / 1000)))
        }
        return offsetSec
    }
}

private func localHour(_ ms: TimeInterval, _ tz: inout TZOffsetCache) -> Double {
    let local = ms / 1000 + tz.offset(atMs: ms)
    var s = local.truncatingRemainder(dividingBy: 86_400)
    if s < 0 { s += 86_400 }
    return s / 3600
}

private func isSleeping(hour h: Double, _ p: UserProfile) -> Bool {
    let a = p.sleepStartHour, b = p.sleepEndHour
    if a == b { return false }
    return a < b ? (h >= a && h < b) : (h >= a || h < b)
}

// Mirror the TS `{ ...p, ...e.patch }` spread: override only the fields the
// patch actually carries, leaving the rest untouched.
private func applyPatch(_ patch: ProfilePatch, to p: inout UserProfile) {
    if let v = patch.weightKg { p.weightKg = v }
    if let v = patch.sex { p.sex = v }
    if let v = patch.awakeHours { p.awakeHours = v }
    if let v = patch.sleepStartHour { p.sleepStartHour = v }
    if let v = patch.sleepEndHour { p.sleepEndHour = v }
    if let v = patch.altitudeM { p.altitudeM = v }
    if patch.hasAmbientTempC { p.ambientTempC = patch.ambientTempC }
    if patch.hasRelativeHumidityPct { p.relativeHumidityPct = patch.relativeHumidityPct }
    if patch.hasDailyGoalOverrideMl { p.dailyGoalOverrideMl = patch.dailyGoalOverrideMl }
    if patch.hasInitialLevelPct { p.initialLevelPct = patch.initialLevelPct }
}

private func effectiveProfile(_ events: [HydrationEvent], _ at: TimeInterval, _ base: UserProfile) -> UserProfile {
    var p = base
    for e in events {
        if e.at > at { break }
        if e.type == .profile, let patch = e.patch { applyPatch(patch, to: &p) }
    }
    return p
}

private func drainMlPerMs(_ p: UserProfile, poisonMult: Double, sleeping: Bool) -> Double {
    var mult = 1.0
    mult *= tempMultiplier(p.ambientTempC)
    mult *= altitudeMultiplier(p.altitudeM)
    mult *= poisonMult
    if sleeping { mult *= SLEEP_MULTIPLIER }
    return (baseDrainMlPerHour(p) * mult) / 3_600_000
}

// ————————— Derived event data (cached across calls) —————————
//
// Mirrors the `Derived` cache in src/engine/hydrationEngine.ts. The integrator
// samples minute by minute from the first event to `now`, and it used to re-scan
// the FULL event list three times per step (profile / alcohol / sport), re-sort
// on every call, and recompute the O(n²) absorption credits twice. Cost grew
// with (days of history × total events), which is exactly what made the widget
// take seconds to redraw after a tap.
//
// Nothing below depends on `at`, only on the event list, so it is derived once
// and reused. Immutable by construction → safe to hand to WidgetKit's background
// queues without a lock on the object itself.
final class Derived: @unchecked Sendable {
    let sorted: [HydrationEvent]
    let profileEvts: [(at: TimeInterval, patch: ProfilePatch)]
    /// Alcohol events with their poison peak precomputed. Sorted ascending.
    let alcohol: [(at: TimeInterval, peak: Double)]
    let sport: [(at: TimeInterval, endAt: TimeInterval, intensity: SportIntensity)]
    let credited: [Double]

    init(_ events: [HydrationEvent]) {
        let s = events.sorted { $0.at < $1.at }
        var profileEvts: [(at: TimeInterval, patch: ProfilePatch)] = []
        var alcohol: [(at: TimeInterval, peak: Double)] = []
        var sport: [(at: TimeInterval, endAt: TimeInterval, intensity: SportIntensity)] = []
        for e in s {
            switch e.type {
            case .profile:
                if let patch = e.patch { profileEvts.append((e.at, patch)) }
            case .alcohol:
                guard let vol = e.volumeMl, let abv = e.abv else { continue }
                alcohol.append((e.at, peakPoisonExtra(ethanolGrams(volumeMl: vol, abv: abv), abv)))
            case .sport:
                guard let dur = e.durationMin, let intensity = e.intensity else { continue }
                sport.append((e.at, e.at + dur * 60_000, intensity))
            default:
                break
            }
        }
        self.sorted = s
        self.profileEvts = profileEvts
        self.alcohol = alcohol
        self.sport = sport
        self.credited = creditedWaterMl(s)
    }
}

// Swift arrays are values, so there is no identity to key a WeakMap on the way
// the TS engine does. A fingerprint over (count, span, checksum of timestamps)
// is enough: in both the app and the widget the log only ever grows by append,
// and a miss just means recomputing what we would have computed anyway.
private func fingerprint(_ events: [HydrationEvent]) -> String {
    var sum: Double = 0
    var lo = Double.greatestFiniteMagnitude
    var hi = -Double.greatestFiniteMagnitude
    for e in events {
        sum += e.at
        if e.at < lo { lo = e.at }
        if e.at > hi { hi = e.at }
    }
    return "\(events.count)|\(lo)|\(hi)|\(sum)"
}

private final class DerivedCache: @unchecked Sendable {
    static let shared = DerivedCache()
    private let lock = NSLock()
    private var key = ""
    private var value: Derived?

    func lookup(_ k: String) -> Derived? {
        lock.lock(); defer { lock.unlock() }
        return key == k ? value : nil
    }
    func store(_ k: String, _ v: Derived) {
        lock.lock(); key = k; value = v; lock.unlock()
    }
}

func derive(_ events: [HydrationEvent]) -> Derived {
    let k = fingerprint(events)
    if let hit = DerivedCache.shared.lookup(k) { return hit }
    let d = Derived(events)
    DerivedCache.shared.store(k, d)
    return d
}

// Poison multiplier from the pre-extracted alcohol list (sorted ascending, so we
// can stop as soon as an event is in the future).
private func poisonMultFrom(_ alcohol: [(at: TimeInterval, peak: Double)], _ t: TimeInterval) -> Double {
    var extra: Double = 0
    for a in alcohol {
        if a.at > t { break }
        let dt = t - a.at
        if dt > POISON_WINDOW_MS { continue }
        let rise = dt / POISON_PEAK_MS
        let fall = (POISON_WINDOW_MS - dt) / POISON_PEAK_MS
        extra += a.peak * min(rise, fall)
    }
    return min(3.0, 1.0 + extra)
}

private func sportLossFrom(
    _ sport: [(at: TimeInterval, endAt: TimeInterval, intensity: SportIntensity)],
    _ t0: TimeInterval, _ t1: TimeInterval, _ p: UserProfile
) -> Double {
    var loss: Double = 0
    for e in sport {
        if e.at >= t1 { break }
        let s = max(e.at, t0)
        let en = min(e.endAt, t1)
        if en <= s { continue }
        loss += sweatRateMlPerHour(p, intensity: e.intensity) * (en - s) / 3_600_000
    }
    return loss
}

// mL lost over ONE sampling step [t, next], the profile already resolved for it.
// Factored out so the timeline path (computeStateSeries) can replay the exact
// same steps in the exact same order as integrateLoss and land on bit-identical
// levels — a re-partitioned quadrature grid drifts by a fraction of a mL, which
// is enough to round the displayed % differently from the app.
private func stepLoss(
    _ d: Derived, _ t: TimeInterval, _ next: TimeInterval,
    _ p: UserProfile, _ tz: inout TZOffsetCache
) -> Double {
    let mid = (t + next) / 2
    let poison = d.alcohol.isEmpty ? 1.0 : poisonMultFrom(d.alcohol, mid)
    var loss = drainMlPerMs(p, poisonMult: poison,
                            sleeping: isSleeping(hour: localHour(mid, &tz), p)) * (next - t)
    if !d.sport.isEmpty { loss += sportLossFrom(d.sport, t, next, p) }
    return loss
}

// Integrate total mL lost between `from` and `to`.
// Time only moves forward, so the profile is carried across steps behind a
// pointer and rebuilt solely when a profile event is actually crossed — instead
// of re-deriving it from the whole event list on every minute.
private func integrateLoss(
    _ d: Derived, _ from: TimeInterval, _ to: TimeInterval,
    _ base: UserProfile, _ tz: inout TZOffsetCache
) -> Double {
    if to <= from { return 0 }
    var acc: Double = 0
    var t = from

    var pi = 0
    var p = base
    while pi < d.profileEvts.count && d.profileEvts[pi].at <= from {
        applyPatch(d.profileEvts[pi].patch, to: &p); pi += 1
    }

    while t < to {
        let next = min(t + STEP_MS, to)
        let mid = (t + next) / 2
        while pi < d.profileEvts.count && d.profileEvts[pi].at <= mid {
            applyPatch(d.profileEvts[pi].patch, to: &p); pi += 1
        }
        acc += stepLoss(d, t, next, p, &tz)
        t = next
    }
    return acc
}

func zoneOf(pct: Double, poisoned: Bool) -> Zone {
    if poisoned { return .poison }
    if pct > 55 { return .green }
    if pct >= 25 { return .amber }
    return .red
}

/// Integer % for UI — round half-up so the widget matches the app (`Math.round`).
func displayLevelPct(_ levelPct: Double) -> Int {
    guard levelPct.isFinite else { return 0 }
    return max(0, min(100, Int(levelPct.rounded())))
}

// Alcohol diuresis (excretion) — always applies in full, not absorption-capped.
func alcoholDiuresisMl(volumeMl: Double, abv: Double) -> Double {
    return ethanolGrams(volumeMl: volumeMl, abv: abv)
        * DIURESIS_ML_PER_G_ETHANOL
        * concentrationFactor(abv)
}

// Single-drink net water in isolation (uncapped). Real timeline caps the water
// via creditedWaterMl / applyEventImpact.
func alcoholNetMl(volumeMl: Double, abv: Double) -> Double {
    let water = volumeMl * (1 - abv / 100)
    return water - alcoholDiuresisMl(volumeMl: volumeMl, abv: abv)
}

private func caffeineNetMl(_ e: HydrationEvent) -> Double {
    let vol = e.volumeMl ?? 0
    let mg = e.caffeineMg ?? 90
    if mg >= 500 { return vol - 250 }
    return vol
}

private func clamp(_ v: Double, _ lo: Double, _ hi: Double) -> Double {
    return min(hi, max(lo, v))
}

// Fluid volume competing for absorption. Alcohol counts by its water content.
private func fluidIntakeMl(_ e: HydrationEvent) -> Double {
    switch e.type {
    case .water, .electrolytes: return e.volumeMl ?? 0
    case .alcohol: return (e.volumeMl ?? 0) * (1 - (e.abv ?? 0) / 100)
    default: return 0
    }
}

// Rolling hourly absorption cap — parallel array of credited mL per event
// (water, electrolytes, AND alcohol's water).
func creditedWaterMl(_ sorted: [HydrationEvent]) -> [Double] {
    var credited = [Double](repeating: 0, count: sorted.count)
    // Sliding window over the trailing hour instead of re-summing the whole
    // history for every event (was O(n²) — the dominant cost once a user had a
    // few hundred events, and it ran twice per computeState call).
    var win: [(at: TimeInterval, credited: Double)] = []
    var used: Double = 0
    var head = 0
    for i in 0..<sorted.count {
        let e = sorted[i]
        let intake = fluidIntakeMl(e)
        if intake <= 0 { continue }
        while head < win.count && win[head].at <= e.at - ABSORB_WINDOW_MS {
            used -= win[head].credited
            head += 1
        }
        let remaining = max(0, MAX_WATER_ABSORB_ML_PER_H - used)
        let cred = min(intake, remaining)
        credited[i] = cred
        if cred > 0 {
            win.append((e.at, cred))
            used += cred
        }
    }
    return credited
}

private func absorbedInWindow(_ d: Derived, _ at: TimeInterval) -> Double {
    var used: Double = 0
    for i in 0..<d.sorted.count {
        let e = d.sorted[i]
        if e.at > at { break }
        if e.at > at - ABSORB_WINDOW_MS { used += d.credited[i] }
    }
    return used
}

func waterAbsorbedInWindow(_ events: [HydrationEvent], _ at: TimeInterval) -> Double {
    return absorbedInWindow(derive(events), at)
}

private func applyEventImpact(_ e: HydrationEvent, _ levelMl: Double, _ cap: Double, _ creditedMl: Double) -> Double {
    switch e.type {
    case .water:
        return clamp(levelMl + creditedMl, 0, cap)
    case .electrolytes:
        return clamp(levelMl + creditedMl * 1.1, 0, cap)
    case .alcohol:
        // Absorbed water (capped) minus full diuresis; saturated → net can go negative.
        return clamp(levelMl + creditedMl - alcoholDiuresisMl(volumeMl: e.volumeMl ?? 0, abv: e.abv ?? 0), 0, cap)
    case .caffeine:
        return clamp(levelMl + caffeineNetMl(e), 0, cap)
    case .sport, .profile:
        return levelMl
    }
}

let FORECAST_HORIZON_MS: TimeInterval = 6 * 3_600_000

// Bar level at `at` BEFORE the final 0…cap clamp. Kept unclamped so the widget's
// timeline can carry it forward from one entry to the next (see
// computeStateSeries) and still land on exactly the value a from-scratch
// computeState would produce.
private func rawLevelMl(_ d: Derived, _ at: TimeInterval, _ base: UserProfile) -> Double {
    let sorted = d.sorted
    var pi = 0
    var p = base
    func advance(_ upTo: TimeInterval) {
        while pi < d.profileEvts.count && d.profileEvts[pi].at <= upTo {
            applyPatch(d.profileEvts[pi].patch, to: &p); pi += 1
        }
    }

    advance(sorted[0].at)
    var levelMl = anchorLevelMl(p)
    var cursor = sorted[0].at
    var tz = TZOffsetCache()

    for i in 0..<sorted.count {
        let e = sorted[i]
        levelMl -= integrateLoss(d, cursor, e.at, base, &tz)
        advance(e.at)
        levelMl = applyEventImpact(e, levelMl, dailyNeedMl(p), d.credited[i])
        cursor = e.at
    }
    levelMl -= integrateLoss(d, cursor, at, base, &tz)
    return levelMl
}

private func emptyState(_ profileNow: UserProfile) -> HydrationState {
    // Use the declared % directly (avoids float noise around the 55 % amber edge).
    let capNow = dailyNeedMl(profileNow)
    let levelPct = resolveInitialLevelPct(profileNow)
    return HydrationState(
        levelMl: clamp((capNow * levelPct) / 100, 0, capNow),
        dailyNeedMl: capNow, levelPct: levelPct,
        zone: zoneOf(pct: levelPct, poisoned: false), poisoned: false, poisonUntil: nil,
        poisonMult: 1, ambleAt: nil, redAt: nil,
        absorbedLastHourMl: 0, absorbCapMl: MAX_WATER_ABSORB_ML_PER_H, saturated: false
    )
}

func computeState(
    events rawEvents: [HydrationEvent],
    at: TimeInterval,
    profile baseProfile: UserProfile = .default
) -> HydrationState {
    return computeState(derived: derive(rawEvents), at: at, profile: baseProfile)
}

func computeState(
    derived d: Derived,
    at: TimeInterval,
    profile baseProfile: UserProfile
) -> HydrationState {
    let sorted = d.sorted
    let profileNow = effectiveProfile(sorted, at, baseProfile)
    if sorted.isEmpty { return emptyState(profileNow) }

    let capNow = dailyNeedMl(profileNow)
    let levelMl = clamp(rawLevelMl(d, at, baseProfile), 0, capNow)
    let (ambleAt, redAt) = forecastFrom(d, at, levelMl, baseProfile, FORECAST_HORIZON_MS)
    return assemble(d, at, levelMl, capNow, ambleAt, redAt)
}

// Pack a level into the full state. Shared by the single-shot and the timeline
// paths so both surfaces can never drift.
private func assemble(
    _ d: Derived, _ at: TimeInterval, _ levelMl: Double, _ capNow: Double,
    _ ambleAt: TimeInterval?, _ redAt: TimeInterval?
) -> HydrationState {
    let poisonMult = poisonMultFrom(d.alcohol, at)
    let poisoned = poisonMult > 1.0
    let levelPct = (levelMl / capNow) * 100
    let absorbed = absorbedInWindow(d, at)
    return HydrationState(
        levelMl: levelMl, dailyNeedMl: capNow, levelPct: levelPct,
        zone: zoneOf(pct: levelPct, poisoned: poisoned), poisoned: poisoned,
        poisonUntil: poisoned ? poisonEndsAt(d.sorted, at) : nil,
        poisonMult: poisonMult, ambleAt: ambleAt, redAt: redAt,
        absorbedLastHourMl: absorbed, absorbCapMl: MAX_WATER_ABSORB_ML_PER_H,
        saturated: absorbed >= MAX_WATER_ABSORB_ML_PER_H * 0.98
    )
}

/// States at a strictly increasing sequence of instants, none of them before the
/// most recent event. The widget builds ~120 timeline entries in one go; doing
/// that with computeState re-integrated the ENTIRE history 120 times over, which
/// is why the bar took seconds to move after a tap. Past `ats[0]` no new event
/// can occur, so the level follows one deterministic curve: integrate the history
/// once, then carry the level forward step by step.
func computeStateSeries(
    events rawEvents: [HydrationEvent],
    ats: [TimeInterval],
    profile baseProfile: UserProfile = .default
) -> [HydrationState] {
    if ats.isEmpty { return [] }
    let d = derive(rawEvents)
    let sorted = d.sorted
    let first = ats[0]

    // Carry-forward assumes nothing happens after `ats[0]`; if that doesn't hold
    // (or there's no history at all) fall back to the general path.
    guard let last = sorted.last, last.at <= first else {
        return ats.map { computeState(derived: d, at: $0, profile: baseProfile) }
    }

    // Anchor on the LAST event, not on ats[0]: computeState integrates from there
    // in whole STEP_MS steps plus one partial step landing on `at`, so replaying
    // that same grid reproduces every entry exactly while sharing all the work.
    // No event (profile included) lies after the anchor, so the profile — and
    // therefore the cap — is fixed for the whole series.
    let anchor = last.at
    let p = effectiveProfile(sorted, anchor, baseProfile)
    let capNow = dailyNeedMl(p)
    let anchorLevel = rawLevelMl(d, anchor, baseProfile)

    // One deterministic curve ⇒ the amber/red crossings are absolute instants,
    // found ONCE over a horizon that covers the whole series instead of per entry.
    let span = ats[ats.count - 1] - first
    let (amber0, red0) = forecastFrom(
        d, first, clamp(anchorLevel - integrateLossFromAnchor(d, anchor, first, p), 0, capNow),
        baseProfile, FORECAST_HORIZON_MS + span)

    var tz = TZOffsetCache()
    var lost: Double = 0        // loss over whole steps from the anchor to gridT
    var gridT = anchor
    var out: [HydrationState] = []
    out.reserveCapacity(ats.count)
    for at in ats {
        while gridT + STEP_MS <= at {
            lost += stepLoss(d, gridT, gridT + STEP_MS, p, &tz)
            gridT += STEP_MS
        }
        // The trailing partial step is per-entry and must NOT fold into `lost`.
        let tail = gridT < at ? stepLoss(d, gridT, at, p, &tz) : 0
        let horizonEnd = at + FORECAST_HORIZON_MS
        out.append(assemble(
            d, at, clamp(anchorLevel - (lost + tail), 0, capNow), capNow,
            crossingAt(amber0, at, horizonEnd), crossingAt(red0, at, horizonEnd)))
    }
    return out
}

private func integrateLossFromAnchor(
    _ d: Derived, _ anchor: TimeInterval, _ to: TimeInterval, _ p: UserProfile
) -> Double {
    var tz = TZOffsetCache()
    var acc: Double = 0
    var t = anchor
    while t < to {
        let next = min(t + STEP_MS, to)
        acc += stepLoss(d, t, next, p, &tz)
        t = next
    }
    return acc
}

// Re-express a crossing found from the head of the series for an entry at `at`:
// already behind us → "now" (what forecastFrom returns when the level is already
// past the threshold); beyond this entry's own 6 h horizon → not reported yet.
private func crossingAt(_ t0: TimeInterval?, _ at: TimeInterval, _ horizonEnd: TimeInterval) -> TimeInterval? {
    guard let t0 = t0 else { return nil }
    if t0 <= at { return at }
    return t0 <= horizonEnd ? t0 : nil
}

func forecast(
    events: [HydrationEvent],
    at: TimeInterval,
    startLevelMl: Double,
    baseProfile: UserProfile,
    horizonMs: TimeInterval = FORECAST_HORIZON_MS
) -> (TimeInterval?, TimeInterval?) {
    return forecastFrom(derive(events), at, startLevelMl, baseProfile, horizonMs)
}

private func forecastFrom(
    _ d: Derived,
    _ at: TimeInterval,
    _ startLevelMl: Double,
    _ baseProfile: UserProfile,
    _ horizonMs: TimeInterval
) -> (TimeInterval?, TimeInterval?) {
    let profileNow = effectiveProfile(d.sorted, at, baseProfile)
    let cap = dailyNeedMl(profileNow)
    let amberT = cap * 0.55
    let redT = cap * 0.25
    var ambleAt: TimeInterval? = startLevelMl <= amberT ? at : nil
    var redAt: TimeInterval? = startLevelMl < redT ? at : nil
    if ambleAt != nil && redAt != nil { return (ambleAt, redAt) }

    var pi = 0
    var p = baseProfile
    while pi < d.profileEvts.count && d.profileEvts[pi].at <= at {
        applyPatch(d.profileEvts[pi].patch, to: &p); pi += 1
    }

    let hasSport = !d.sport.isEmpty
    var tz = TZOffsetCache()
    var level = startLevelMl
    var t = at
    let end = at + horizonMs
    while t < end {
        let next = min(t + STEP_MS, end)
        let dt = next - t
        let mid = (t + next) / 2
        while pi < d.profileEvts.count && d.profileEvts[pi].at <= mid {
            applyPatch(d.profileEvts[pi].patch, to: &p); pi += 1
        }
        let poison = poisonMultFrom(d.alcohol, mid)
        let before = level
        var loss = drainMlPerMs(p, poisonMult: poison, sleeping: isSleeping(hour: localHour(mid, &tz), p)) * dt
        if hasSport { loss += sportLossFrom(d.sport, t, next, p) }
        let after = before - loss
        // Interpolate the crossing within the step for a second-precise result.
        if ambleAt == nil && after <= amberT {
            let frac = loss > 0 ? (before - amberT) / loss : 0
            ambleAt = t + frac * dt
        }
        if redAt == nil && after < redT {
            let frac = loss > 0 ? (before - redT) / loss : 0
            redAt = t + frac * dt
            break
        }
        level = after
        t = next
    }
    return (ambleAt, redAt)
}

// Loader for the widget: reads the snapshot RN wrote into the App Group.
struct SharedSnapshot: Decodable {
    let version: Int
    let updatedAt: TimeInterval
    let events: [HydrationEvent]
    let profile: UserProfile
}

func loadSharedSnapshot(appGroup: String = "group.com.shipply.hydraapp") -> SharedSnapshot? {
    guard let defaults = UserDefaults(suiteName: appGroup),
          let raw = defaults.string(forKey: "hydraSnapshot"),
          let data = raw.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(SharedSnapshot.self, from: data)
}
