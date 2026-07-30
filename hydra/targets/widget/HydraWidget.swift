import WidgetKit
import SwiftUI
import AppIntents

// ============================================================================
// HYDRA widgets — SwiftUI reproduction of the landing-page mockup designs.
//   • accessoryRectangular : lock screen, iOS renders it monochrome
//   • systemSmall          : home screen, full colour
//   • systemMedium         : home screen "banner", colour + EAU/ALCOOL buttons
// All three share the same computeState() engine (HydrationEngine.swift) and
// the same colour tokens, so the app and the widget always match.
// ============================================================================

// ---- Colour tokens (mirror src/theme/colors.ts) ----
extension Color {
    static let hGreen  = Color(red: 0.243, green: 0.878, blue: 0.478) // #3EE07A
    static let hAmber  = Color(red: 1.000, green: 0.690, blue: 0.125) // #FFB020
    static let hRed    = Color(red: 1.000, green: 0.231, blue: 0.290) // #FF3B4A
    static let hPoison = Color(red: 0.706, green: 0.298, blue: 1.000) // #B44CFF
    static let hEmpty  = Color(red: 0.110, green: 0.125, blue: 0.149) // #1C2026
    static let hText   = Color(red: 0.929, green: 0.937, blue: 0.949) // #EDEFF2
    static let hDim    = Color(red: 0.486, green: 0.510, blue: 0.549) // #7C828C
}

// ---- Timeline ----
struct HydraEntry: TimelineEntry {
    let date: Date
    let state: HydrationState
}

struct HydraProvider: TimelineProvider {
    func placeholder(in context: Context) -> HydraEntry {
        HydraEntry(date: Date(), state: HydrationState(
            levelMl: 1750, dailyNeedMl: 2240, levelPct: 78,
            zone: .green, poisoned: false, poisonUntil: nil,
            poisonMult: 1, ambleAt: nil, redAt: nil,
            absorbedLastHourMl: 0, absorbCapMl: 1000, saturated: false))
    }
    func getSnapshot(in context: Context, completion: @escaping (HydraEntry) -> Void) {
        completion(entry(at: Date()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<HydraEntry>) -> Void) {
        let now = Date()
        // Dense entries so the home-screen % tracks the live app drain.
        // ~1.5 %/15 min of passive drain made a 15-min step look "off by 1 %".
        // 2-min steps for 4 h ≈ 120 entries (well within WidgetKit budgets).
        let horizon: TimeInterval = 4 * 3600
        let step: TimeInterval = 2 * 60
        var dates: [Date] = []
        var i = 0.0
        while i <= horizon {
            dates.append(now.addingTimeInterval(i))
            i += step
        }

        // The snapshot is decoded ONCE for the whole timeline and the states are
        // produced in a single incremental pass. Before, every entry re-read and
        // re-parsed the App Group JSON and then re-integrated the user's entire
        // history from their first ever event — 120 times per reload. That work
        // is what put 3+ seconds between tapping ＋EAU and the bar moving.
        guard let snap = loadSharedSnapshot() else {
            let entries = dates.map { HydraEntry(date: $0, state: HydraProvider.fallbackState) }
            completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(horizon))))
            return
        }
        let states = computeStateSeries(
            events: snap.events,
            ats: dates.map { $0.timeIntervalSince1970 * 1000 },
            profile: snap.profile)
        var entries: [HydraEntry] = []
        entries.reserveCapacity(dates.count)
        for (i, date) in dates.enumerated() where i < states.count {
            entries.append(HydraEntry(date: date, state: states[i]))
        }
        completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(horizon))))
    }

    // Shown only when the App Group snapshot is missing or unreadable (app never
    // launched since install).
    static let fallbackState = HydrationState(
        levelMl: 2240, dailyNeedMl: 2240, levelPct: 100, zone: .green,
        poisoned: false, poisonUntil: nil, poisonMult: 1, ambleAt: nil, redAt: nil,
        absorbedLastHourMl: 0, absorbCapMl: 1000, saturated: false)

    private func entry(at date: Date) -> HydraEntry {
        let ms = date.timeIntervalSince1970 * 1000
        if let snap = loadSharedSnapshot() {
            return HydraEntry(date: date, state: computeState(events: snap.events, at: ms, profile: snap.profile))
        }
        return HydraEntry(date: date, state: HydraProvider.fallbackState)
    }
}

// ---- Shared helpers ----
private func zoneColor(_ s: HydrationState) -> Color {
    switch s.zone { case .poison: return .hPoison; case .red: return .hRed; case .amber: return .hAmber; case .green: return .hGreen }
}
private func statusText(_ s: HydrationState) -> String {
    if s.poisoned { return "EMPOISONNÉ" }
    switch s.zone { case .red: return "CRITIQUE"; case .amber: return "TU SÈCHES"; default: return "HYDRATÉ" }
}
private func countdown(_ s: HydrationState) -> String {
    guard let red = s.redAt else { return "—" }
    let secs = red / 1000 - Date().timeIntervalSince1970
    if secs <= 0 { return "0m" }
    let h = Int(secs / 3600), m = (Int(secs) % 3600) / 60
    return h > 0 ? "→ \(h)h\(String(format: "%02d", m))" : "→ \(m)m"
}

// ---- Segmented bar ----
struct HydraSegBar: View {
    let pct: Double
    let color: Color
    var mono: Bool = false
    var height: CGFloat = 11
    var count: Int = 14
    var body: some View {
        let filled = Int(((pct / 100.0) * Double(count)).rounded())
        HStack(spacing: 2.5) {
            ForEach(0..<count, id: \.self) { i in
                RoundedRectangle(cornerRadius: 2.5)
                    .fill(i < filled ? (mono ? Color.primary : color)
                                     : (mono ? Color.primary.opacity(0.22) : Color.hEmpty))
                    .frame(height: height)
            }
        }
    }
}

// A rounded action button matching the mockup's ".w-btn".
@available(iOS 17.0, *)
struct HydraTapButton<I: AppIntent>: View {
    let title: String
    let color: Color
    let intent: I
    var body: some View {
        Button(intent: intent) {
            Text(title)
                .font(.system(size: 10.5, weight: .heavy))
                .kerning(0.5)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 7)
                .background(color.opacity(0.16))
                .overlay(RoundedRectangle(cornerRadius: 11).stroke(color.opacity(0.42), lineWidth: 1))
                .foregroundColor(color)
                .clipShape(RoundedRectangle(cornerRadius: 11))
        }
        .buttonStyle(.plain)
    }
}

// ============================================================================
// LOCK SCREEN — accessoryRectangular (monochrome, tiny)
// ============================================================================
struct HydraRectangularView: View {
    let state: HydrationState
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("HYDRA").font(.system(size: 10, weight: .bold, design: .monospaced))
                Spacer()
                Text("\(displayLevelPct(state.levelPct))%").font(.system(size: 12, weight: .bold, design: .monospaced))
            }
            HydraSegBar(pct: state.levelPct, color: .hGreen, mono: true, height: 10)
            HStack {
                Text(statusText(state)).font(.system(size: 9, weight: .semibold))
                Spacer()
                Text(countdown(state)).font(.system(size: 9, design: .monospaced)).foregroundStyle(.secondary)
            }
        }
        .containerBackground(for: .widget) { Color.black }
    }
}

// ============================================================================
// HOME SMALL — systemSmall (colour)
// ============================================================================
struct HydraSmallView: View {
    let state: HydrationState
    var body: some View {
        let c = zoneColor(state)
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("HYDRA").font(.system(size: 10, weight: .black)).kerning(2).foregroundColor(.hDim)
                Spacer()
                Text("💧").font(.system(size: 12))
            }
            Text("\(displayLevelPct(state.levelPct))%")
                .font(.system(size: 38, weight: .black)).foregroundColor(c)
                .minimumScaleFactor(0.6).lineLimit(1)
            HydraSegBar(pct: state.levelPct, color: c, height: 10)
            HStack {
                Text(statusText(state)).font(.system(size: 9.5, weight: .black)).kerning(0.6).foregroundColor(c)
                Spacer()
                Text(countdown(state)).font(.system(size: 9, design: .monospaced)).foregroundColor(.hDim)
            }
            if #available(iOS 17.0, *) {
                HydraTapButton(title: "＋ EAU", color: c, intent: LogWaterIntent(volumeMl: 250))
            }
        }
        .padding(2)
        .containerBackground(for: .widget) { Color(red: 0.039, green: 0.047, blue: 0.063) } // #0a0c10
    }
}

// ============================================================================
// HOME BANNER — systemMedium (colour + EAU + ALCOOL tiers)
// ============================================================================
struct HydraMediumView: View {
    let state: HydrationState
    var body: some View {
        let c = zoneColor(state)
        VStack(spacing: 8) {
            HStack(spacing: 12) {
                // left: stats
                VStack(alignment: .leading, spacing: 1) {
                    Text("HYDRA").font(.system(size: 9, weight: .black)).kerning(1.5).foregroundColor(.hDim)
                    Text("\(displayLevelPct(state.levelPct))%").font(.system(size: 30, weight: .black)).foregroundColor(c)
                        .minimumScaleFactor(0.6).lineLimit(1)
                    Text(statusText(state)).font(.system(size: 9, weight: .black)).kerning(0.4).foregroundColor(c)
                        .lineLimit(1).minimumScaleFactor(0.7)
                }
                .fixedSize()
                .overlay(Rectangle().fill(Color.hEmpty).frame(width: 1), alignment: .trailing)
                .padding(.trailing, 12)
                // right: need + countdown + bar
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("besoin \(Int(state.dailyNeedMl)) mL").font(.system(size: 8.5, design: .monospaced)).foregroundColor(.hDim).lineLimit(1).minimumScaleFactor(0.7)
                        Spacer(minLength: 4)
                        Text(countdown(state)).font(.system(size: 8.5, design: .monospaced)).foregroundColor(.hDim).lineLimit(1)
                    }
                    HydraSegBar(pct: state.levelPct, color: c, height: 11)
                }
            }
            if #available(iOS 17.0, *) {
                // One compact action row: water + the three alcohol tiers, all
                // inside the widget bounds (no boxed wrapper so it fits vertically).
                HStack(spacing: 6) {
                    HydraTapButton(title: "＋ EAU", color: c, intent: LogWaterIntent(volumeMl: 250))
                    HydraTapButton(title: "LÉGER",  color: .hAmber, intent: LogAlcoholIntent(volumeMl: 400, abv: 5))
                    HydraTapButton(title: "MOYEN",  color: .hAmber, intent: LogAlcoholIntent(volumeMl: 150, abv: 14))
                    HydraTapButton(title: "FORT",   color: .hRed,   intent: LogAlcoholIntent(volumeMl: 40,  abv: 40))
                }
            }
        }
        .containerBackground(for: .widget) { Color(red: 0.039, green: 0.047, blue: 0.063) }
    }
}

// ============================================================================
// Widget entry point — routes each family to its view
// ============================================================================
struct HydraWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: HydraEntry
    var body: some View {
        switch family {
        case .systemMedium: HydraMediumView(state: entry.state)
        case .systemSmall:  HydraSmallView(state: entry.state)
        default:            HydraRectangularView(state: entry.state) // accessoryRectangular
        }
    }
}

struct HydraLockWidget: Widget {
    let kind = "HydraLockWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HydraProvider()) { entry in
            HydraWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("HYDRA")
        .description("Ta barre de vie hydratation.")
        .supportedFamilies([.accessoryRectangular, .systemSmall, .systemMedium])
    }
}

@main
struct HydraWidgetBundle: WidgetBundle {
    var body: some Widget {
        HydraLockWidget()
        // The lock-screen Control needs the iOS 18 SDK (Xcode 16). Compile it
        // only on Xcode 16+ so an older EAS/Xcode 15 image still builds.
        #if compiler(>=6.0)
        if #available(iOS 18.0, *) { HydraWaterControl() }
        #endif
    }
}
