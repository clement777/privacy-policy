import Foundation

// Strict port of src/engine/hydrationEngine.ts (v2 physiological model).
// Any change to the TS source of truth MUST land here in the same commit.
// The tests in HydrationEngineTests.swift mirror the 8 acceptance cases.

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

private func poisonMultiplierAt(_ events: [HydrationEvent], _ t: TimeInterval) -> Double {
    var extra: Double = 0
    for e in events where e.type == .alcohol {
        guard let vol = e.volumeMl, let abv = e.abv else { continue }
        if t < e.at || t > e.at + POISON_WINDOW_MS { continue }
        let g = ethanolGrams(volumeMl: vol, abv: abv)
        extra += poisonExtraFromEvent(e.at, g, abv, t)
    }
    return min(3.0, 1.0 + extra)
}

private func poisonEndsAt(_ events: [HydrationEvent], _ now: TimeInterval) -> TimeInterval? {
    var end: TimeInterval? = nil
    for e in events where e.type == .alcohol {
        let we = e.at + POISON_WINDOW_MS
        if now <= we { end = end == nil ? we : max(end!, we) }
    }
    return end
}

private func isSleeping(at ms: TimeInterval, _ p: UserProfile) -> Bool {
    let d = Date(timeIntervalSince1970: ms / 1000)
    let c = Calendar.current.dateComponents([.hour, .minute, .second], from: d)
    let h = Double(c.hour ?? 0) + Double(c.minute ?? 0) / 60 + Double(c.second ?? 0) / 3600
    let a = p.sleepStartHour, b = p.sleepEndHour
    if a == b { return false }
    return a < b ? (h >= a && h < b) : (h >= a || h < b)
}

private func effectiveProfile(_ events: [HydrationEvent], _ at: TimeInterval, _ base: UserProfile) -> UserProfile {
    var p = base
    for e in events {
        if e.at > at { break }
        if e.type == .profile, let patch = e.patch {
            // Mirror the TS `{ ...p, ...e.patch }` spread: override only the
            // fields the patch actually carries, leaving the rest untouched.
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

private func sportLossMlOver(_ events: [HydrationEvent], _ t0: TimeInterval, _ t1: TimeInterval, _ p: UserProfile) -> Double {
    var loss: Double = 0
    for e in events where e.type == .sport {
        guard let dur = e.durationMin, let intensity = e.intensity else { continue }
        let endAt = e.at + dur * 60_000
        let s = max(e.at, t0)
        let en = min(endAt, t1)
        if en <= s { continue }
        let rate = sweatRateMlPerHour(p, intensity: intensity)
        loss += rate * (en - s) / 3_600_000
    }
    return loss
}

private func integrateLoss(_ events: [HydrationEvent], _ from: TimeInterval, _ to: TimeInterval, _ base: UserProfile) -> Double {
    if to <= from { return 0 }
    var acc: Double = 0
    var t = from
    while t < to {
        let next = min(t + STEP_MS, to)
        let mid = (t + next) / 2
        let p = effectiveProfile(events, mid, base)
        let poison = poisonMultiplierAt(events, mid)
        acc += drainMlPerMs(p, poisonMult: poison, sleeping: isSleeping(at: mid, p)) * (next - t)
        acc += sportLossMlOver(events, t, next, p)
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
    var hist: [(at: TimeInterval, credited: Double)] = []
    for i in 0..<sorted.count {
        let e = sorted[i]
        let intake = fluidIntakeMl(e)
        if intake <= 0 { continue }
        var used: Double = 0
        for h in hist where h.at > e.at - ABSORB_WINDOW_MS && h.at <= e.at {
            used += h.credited
        }
        let remaining = max(0, MAX_WATER_ABSORB_ML_PER_H - used)
        let cred = min(intake, remaining)
        credited[i] = cred
        hist.append((e.at, cred))
    }
    return credited
}

func waterAbsorbedInWindow(_ sorted: [HydrationEvent], _ at: TimeInterval) -> Double {
    let credited = creditedWaterMl(sorted)
    var used: Double = 0
    for i in 0..<sorted.count {
        let e = sorted[i]
        if e.at > at - ABSORB_WINDOW_MS && e.at <= at { used += credited[i] }
    }
    return used
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

func computeState(
    events rawEvents: [HydrationEvent],
    at: TimeInterval,
    profile baseProfile: UserProfile = .default
) -> HydrationState {
    let sorted = rawEvents.sorted { $0.at < $1.at }
    let profileNow = effectiveProfile(sorted, at, baseProfile)
    let capNow = dailyNeedMl(profileNow)

    if sorted.isEmpty {
        // Use the declared % directly (avoids float noise around the 55 % amber edge).
        let levelPct = resolveInitialLevelPct(profileNow)
        let levelMl = clamp((capNow * levelPct) / 100, 0, capNow)
        return HydrationState(
            levelMl: levelMl, dailyNeedMl: capNow, levelPct: levelPct,
            zone: zoneOf(pct: levelPct, poisoned: false), poisoned: false, poisonUntil: nil,
            poisonMult: 1, ambleAt: nil, redAt: nil,
            absorbedLastHourMl: 0, absorbCapMl: MAX_WATER_ABSORB_ML_PER_H, saturated: false
        )
    }

    let credited = creditedWaterMl(sorted)
    let startProfile = effectiveProfile(sorted, sorted.first!.at, baseProfile)
    var levelMl = anchorLevelMl(startProfile)
    var cursor = sorted.first!.at

    for i in 0..<sorted.count {
        let e = sorted[i]
        levelMl -= integrateLoss(sorted, cursor, e.at, baseProfile)
        let p = effectiveProfile(sorted, e.at, baseProfile)
        levelMl = applyEventImpact(e, levelMl, dailyNeedMl(p), credited[i])
        cursor = e.at
    }
    levelMl -= integrateLoss(sorted, cursor, at, baseProfile)
    levelMl = clamp(levelMl, 0, capNow)

    let poisonMult = poisonMultiplierAt(sorted, at)
    let poisoned = poisonMult > 1.0
    let poisonUntil = poisoned ? poisonEndsAt(sorted, at) : nil
    let levelPct = (levelMl / capNow) * 100
    let zone = zoneOf(pct: levelPct, poisoned: poisoned)
    let (ambleAt, redAt) = forecast(events: sorted, at: at, startLevelMl: levelMl, baseProfile: baseProfile)
    let absorbed = waterAbsorbedInWindow(sorted, at)

    return HydrationState(
        levelMl: levelMl, dailyNeedMl: capNow, levelPct: levelPct,
        zone: zone, poisoned: poisoned, poisonUntil: poisonUntil,
        poisonMult: poisonMult, ambleAt: ambleAt, redAt: redAt,
        absorbedLastHourMl: absorbed, absorbCapMl: MAX_WATER_ABSORB_ML_PER_H,
        saturated: absorbed >= MAX_WATER_ABSORB_ML_PER_H * 0.98
    )
}

func forecast(
    events: [HydrationEvent],
    at: TimeInterval,
    startLevelMl: Double,
    baseProfile: UserProfile,
    horizonMs: TimeInterval = 6 * 3_600_000
) -> (TimeInterval?, TimeInterval?) {
    let profileNow = effectiveProfile(events, at, baseProfile)
    let cap = dailyNeedMl(profileNow)
    let amberT = cap * 0.55
    let redT = cap * 0.25
    var ambleAt: TimeInterval? = startLevelMl <= amberT ? at : nil
    var redAt: TimeInterval? = startLevelMl < redT ? at : nil
    if ambleAt != nil && redAt != nil { return (ambleAt, redAt) }
    var level = startLevelMl
    var t = at
    let end = at + horizonMs
    while t < end {
        let next = min(t + STEP_MS, end)
        let dt = next - t
        let mid = (t + next) / 2
        let p = effectiveProfile(events, mid, baseProfile)
        let poison = poisonMultiplierAt(events, mid)
        let before = level
        let loss = drainMlPerMs(p, poisonMult: poison, sleeping: isSleeping(at: mid, p)) * dt
                 + sportLossMlOver(events, t, next, p)
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
