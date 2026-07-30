import AppIntents
import WidgetKit
import Foundation

// App Intents let the widget's buttons run an action WITHOUT opening the app
// (iOS 17+ for in-widget Button/Toggle, iOS 18+ for lock-screen Controls).
// The intent appends an event straight into the App Group snapshot the RN app
// and the widget already share, then reloads the widget timelines. No bridge,
// no launch — the exact same data path the app uses.

private let APP_GROUP = "group.com.shipply.hydraapp"
private let SNAPSHOT_KEY = "hydraSnapshot"

// Read-write mirror of the shared snapshot (SharedSnapshot in the engine is
// decode-only). Reuses the Codable HydrationEvent / UserProfile from the engine.
// Internal (not private) so HydraStore's internal methods can expose it in their
// signatures without triggering Swift access-control errors.
struct HydraSnapshotRW: Codable {
    var version: Int
    var updatedAt: TimeInterval
    var events: [HydrationEvent]
    var profile: UserProfile
}

enum HydraStore {
    static func loadRW() -> HydraSnapshotRW? {
        guard let d = UserDefaults(suiteName: APP_GROUP),
              let raw = d.string(forKey: SNAPSHOT_KEY),
              let data = raw.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(HydraSnapshotRW.self, from: data)
    }

    static func save(_ snap: HydraSnapshotRW) {
        guard let d = UserDefaults(suiteName: APP_GROUP),
              let out = try? JSONEncoder().encode(snap),
              let s = String(data: out, encoding: .utf8) else { return }
        d.set(s, forKey: SNAPSHOT_KEY)
    }

    // Append a water event, honoring the rolling absorption cap so a spammed
    // button can't over-fill the bar — same guard as the RN store.
    @discardableResult
    static func logWater(volumeMl: Double) -> Bool {
        guard var snap = loadRW() else { return false }
        let now = Date().timeIntervalSince1970 * 1000
        // waterAbsorbedInWindow sorts + credits through the shared Derived cache
        // (see HydrationEngine) — no need to pre-sort a copy of the whole log here.
        let used = waterAbsorbedInWindow(snap.events, now)
        if used >= MAX_WATER_ABSORB_ML_PER_H * 0.98 { return false } // saturated
        snap.events.append(HydrationEvent(
            type: .water, at: now, volumeMl: volumeMl, abv: nil,
            caffeineMg: nil, durationMin: nil, intensity: nil, patch: nil))
        snap.updatedAt = now
        save(snap)
        return true
    }

    // Append an alcohol event (used by the systemMedium tier buttons).
    @discardableResult
    static func logAlcohol(volumeMl: Double, abv: Double) -> Bool {
        guard var snap = loadRW() else { return false }
        let now = Date().timeIntervalSince1970 * 1000
        snap.events.append(HydrationEvent(
            type: .alcohol, at: now, volumeMl: volumeMl, abv: abv,
            caffeineMg: nil, durationMin: nil, intensity: nil, patch: nil))
        snap.updatedAt = now
        save(snap)
        return true
    }
}

// The shared logging action. iOS 16+ (App Intents framework); the interactive
// widget button that calls it needs iOS 17, the Control needs iOS 18.
@available(iOS 16.0, *)
struct LogWaterIntent: AppIntent {
    static var title: LocalizedStringResource = "Boire de l'eau"
    static var description = IntentDescription("Ajoute un verre d'eau à HYDRA.")

    @Parameter(title: "Volume (mL)")
    var volumeMl: Int?

    init() {}
    init(volumeMl: Int) { self.volumeMl = volumeMl }

    func perform() async throws -> some IntentResult {
        HydraStore.logWater(volumeMl: Double(volumeMl ?? 250))
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

// Alcohol tiers for the systemMedium widget buttons (Léger / Moyen / Fort).
@available(iOS 16.0, *)
struct LogAlcoholIntent: AppIntent {
    static var title: LocalizedStringResource = "Logger un alcool"
    static var description = IntentDescription("Ajoute une boisson alcoolisée à HYDRA.")

    @Parameter(title: "Volume (mL)") var volumeMl: Int?
    @Parameter(title: "Degré (%)") var abv: Int?

    init() {}
    init(volumeMl: Int, abv: Int) { self.volumeMl = volumeMl; self.abv = abv }

    func perform() async throws -> some IntentResult {
        HydraStore.logAlcohol(volumeMl: Double(volumeMl ?? 400), abv: Double(abv ?? 5))
        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}
