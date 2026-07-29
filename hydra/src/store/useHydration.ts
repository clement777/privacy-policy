import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  DEFAULT_PROFILE,
  DEFAULT_PRESETS,
  DrinkPreset,
  HydrationEvent,
  remainingAbsorptionMl,
  SportIntensity,
  UserProfile,
} from '../engine/hydrationEngine';

export type LogResult = { ok: true } | { ok: false; reason: 'saturated'; remainingMl: number };
export type SportLogResult =
  | { ok: true }
  | { ok: false; reason: 'session_active'; remainingSec: number };
import {
  readSharedSnapshot,
  reloadWidgetTimelines,
  writeSharedSnapshot,
} from '../native/appGroupBridge';
import { updateAndroidWidgets } from '../native/androidWidget';
import {
  DEFAULT_WIDGET_SETTINGS,
  WidgetSettings,
} from './widgetSettings';
import { rescheduleNotifications } from '../notifications/scheduler';
import { activeSportSessions } from '../util/sport';

interface HydraState {
  events: HydrationEvent[];
  profile: UserProfile;
  presets: DrinkPreset[];
  widget: WidgetSettings;
  hydrated: boolean;
  onboarded: boolean;
  // Local-only: "Refaire le questionnaire" from settings. Must NOT flip
  // `onboarded` — a cloud pull would otherwise re-apply onboarded=false after
  // Terminer and loop the user back to step 0.
  reconfiguring: boolean;
  // Which Supabase user the local hydration data belongs to. null = anonymous
  // (onboarding funnel) or wiped after sign-out. Prevents pushing user A's
  // local bar into user B's cloud row on account switch.
  dataOwnerUserId: string | null;
  completeOnboarding: (
    profilePatch: Partial<UserProfile>,
    widgetPatch: Partial<WidgetSettings>
  ) => Promise<void>;
  restartOnboarding: () => void;
  // Wipe local hydration + widget snapshot (call on sign-out / account switch).
  resetLocalData: () => Promise<void>;
  logPreset: (key: string) => Promise<LogResult>;
  logWater: (volumeMl: number) => Promise<LogResult>;
  logCustomDrink: (kind: 'water' | 'electrolytes' | 'alcohol' | 'caffeine', args: { volumeMl: number; abv?: number; caffeineMg?: number }) => Promise<void>;
  logSport: (durationMin: number, intensity: SportIntensity) => Promise<SportLogResult>;
  undo: () => Promise<void>;
  deleteEvent: (at: number) => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  updateWidget: (patch: Partial<WidgetSettings>) => Promise<void>;
  refreshWidget: () => Promise<void>;
  // Merge events the iOS widget's buttons appended into the shared App Group
  // snapshot (App Intents run without launching the app). Call on foreground
  // and right after rehydration, BEFORE the store overwrites the snapshot.
  pullFromWidget: () => Promise<void>;
  _sync: () => Promise<void>;

  // ── Cloud sync (Supabase) ──────────────────────────────────────────────
  deletedKeys: string[]; // tombstones: client_ids deleted locally, pending push
  cloudCursor: string | null; // max events.updated_at pulled so far (ISO)
  clearDeleted: (keys: string[]) => void;
  setCloudCursor: (cursor: string | null) => void;
  claimDataOwner: (userId: string) => void;
  // Merge server changes into the local store (idempotent).
  mergeCloud: (args: {
    addEvents: HydrationEvent[];
    removeKeys: string[];
    profile?: UserProfile;
    widget?: Partial<WidgetSettings>;
    onboarded?: boolean;
  }) => Promise<void>;
}

// Stable per-event sync key (mirrors backend `client_id`). No two events of the
// same type share a millisecond, so type+at is unique and deterministic.
export const eventKey = (e: HydrationEvent): string => `${e.type}_${e.at}`;

// Rescheduling notifications wipes the whole schedule and re-creates it — a
// dozen sequential native round-trips. Awaiting that inside a drink tap is what
// made the buttons feel laggy, and logging several drinks in a row repeated the
// entire dance each time. Debounce it off the critical path; the timer re-reads
// the store when it fires, so it always schedules from the latest state.
let notifTimer: ReturnType<typeof setTimeout> | null = null;

export const useHydration = create<HydraState>()(
  persist(
    (set, get) => ({
      events: [],
      profile: DEFAULT_PROFILE,
      presets: DEFAULT_PRESETS,
      widget: DEFAULT_WIDGET_SETTINGS,
      hydrated: false,
      onboarded: false,
      reconfiguring: false,
      dataOwnerUserId: null,
      deletedKeys: [],
      cloudCursor: null,

      // First-run setup: apply the collected profile + water container in one
      // shot (single profile event, single sync) and flip the onboarded flag.
      async completeOnboarding(profilePatch, widgetPatch) {
        const nextProfile = { ...get().profile, ...profilePatch };
        const evt: HydrationEvent = { type: 'profile', at: Date.now(), patch: profilePatch };
        set({
          profile: nextProfile,
          widget: { ...get().widget, ...widgetPatch },
          events: [...get().events, evt],
          onboarded: true,
          reconfiguring: false,
        });
        await get()._sync();
      },

      // Re-open the guided questionnaire from settings. Keep onboarded=true so
      // cloud sync cannot yank the user back into a first-run loop after finish.
      restartOnboarding() {
        set({ reconfiguring: true });
      },

      // Full local wipe — used on sign-out and when switching to another account
      // so Clem's bar never lands in the Apple-review cloud row.
      async resetLocalData() {
        set({
          events: [],
          profile: { ...DEFAULT_PROFILE },
          presets: DEFAULT_PRESETS,
          widget: { ...DEFAULT_WIDGET_SETTINGS },
          onboarded: false,
          reconfiguring: false,
          dataOwnerUserId: null,
          deletedKeys: [],
          cloudCursor: null,
        });
        await get()._sync();
      },

      claimDataOwner(userId) {
        set({ dataOwnerUserId: userId });
      },

      // Pull widget-logged events (iOS App Intents) out of the shared snapshot
      // and merge any we don't already have. Then _sync() writes the merged
      // state back so the widget and the cloud stay in step.
      async pullFromWidget() {
        const snap = await readSharedSnapshot();
        if (!snap || !Array.isArray(snap.events)) return;
        const have = new Set(get().events.map(eventKey));
        const deleted = new Set(get().deletedKeys);
        const add = snap.events.filter((e) => {
          const k = eventKey(e);
          return !have.has(k) && !deleted.has(k);
        });
        if (add.length === 0) return;
        const next = [...get().events, ...add].sort((a, b) => a.at - b.at);
        set({ events: next });
        await get()._sync();
      },

      async logPreset(key): Promise<LogResult> {
        const preset = get().presets.find((p) => p.key === key);
        if (!preset) return { ok: true };
        const at = Date.now();
        // Saturation guard: you can't drink faster than your body absorbs.
        // Block water/electrolytes when the rolling-hour capacity is used up.
        if (preset.kind === 'water' || preset.kind === 'electrolytes') {
          const remaining = remainingAbsorptionMl(get().events, at);
          if (remaining < 30) {
            return { ok: false, reason: 'saturated', remainingMl: remaining };
          }
        }
        let e: HydrationEvent;
        if (preset.kind === 'water') e = { type: 'water', at, volumeMl: preset.volumeMl };
        else if (preset.kind === 'electrolytes') e = { type: 'electrolytes', at, volumeMl: preset.volumeMl };
        else if (preset.kind === 'alcohol') e = { type: 'alcohol', at, volumeMl: preset.volumeMl, abv: preset.abv ?? 5 };
        else e = { type: 'caffeine', at, volumeMl: preset.volumeMl, caffeineMg: preset.caffeineMg };
        set({ events: [...get().events, e] });
        await get()._sync();
        return { ok: true };
      },

      async logWater(volumeMl): Promise<LogResult> {
        const at = Date.now();
        const remaining = remainingAbsorptionMl(get().events, at);
        if (remaining < 30) {
          return { ok: false, reason: 'saturated', remainingMl: remaining };
        }
        set({ events: [...get().events, { type: 'water', at, volumeMl }] });
        await get()._sync();
        return { ok: true };
      },

      async logCustomDrink(kind, args) {
        const at = Date.now();
        let e: HydrationEvent;
        if (kind === 'alcohol') e = { type: 'alcohol', at, volumeMl: args.volumeMl, abv: args.abv ?? 5 };
        else if (kind === 'caffeine') e = { type: 'caffeine', at, volumeMl: args.volumeMl, caffeineMg: args.caffeineMg };
        else if (kind === 'electrolytes') e = { type: 'electrolytes', at, volumeMl: args.volumeMl };
        else e = { type: 'water', at, volumeMl: args.volumeMl };
        set({ events: [...get().events, e] });
        await get()._sync();
      },

      async logSport(durationMin, intensity): Promise<SportLogResult> {
        const at = Date.now();
        const { events, profile } = get();
        const active = activeSportSessions(events, at, profile);
        if (active.length > 0) {
          return {
            ok: false,
            reason: 'session_active',
            remainingSec: active[0].remainingSec,
          };
        }
        set({
          events: [...events, { type: 'sport', at, durationMin, intensity }],
        });
        await get()._sync();
        return { ok: true };
      },

      async undo() {
        const evs = get().events;
        for (let i = evs.length - 1; i >= 0; i--) {
          if (evs[i].type !== 'profile') {
            const removed = evs[i];
            set({
              events: [...evs.slice(0, i), ...evs.slice(i + 1)],
              deletedKeys: [...get().deletedKeys, eventKey(removed)],
            });
            await get()._sync();
            return;
          }
        }
      },

      async deleteEvent(at) {
        const removed = get().events.filter((e) => e.at === at);
        set({
          events: get().events.filter((e) => e.at !== at),
          deletedKeys: [
            ...get().deletedKeys,
            ...removed.map((e) => eventKey(e)),
          ],
        });
        await get()._sync();
      },

      async updateProfile(patch) {
        const next = { ...get().profile, ...patch };
        // Also log a profile-change event so historical recomputes remain
        // faithful (e.g. weight change kicks in from that timestamp).
        const evt: HydrationEvent = { type: 'profile', at: Date.now(), patch };
        set({ profile: next, events: [...get().events, evt] });
        await get()._sync();
      },

      async updateWidget(patch) {
        set({ widget: { ...get().widget, ...patch } });
        // Widget prefs live app-side; still push a fresh snapshot + reload so
        // the widget picks up any profile-driven values immediately.
        await get()._sync();
      },

      async refreshWidget() {
        await get()._sync();
      },

      async _sync() {
        const { events, profile, widget } = get();
        await writeSharedSnapshot({
          version: 2,
          updatedAt: Date.now(),
          events,
          profile,
          widget,
        });
        await reloadWidgetTimelines();
        await updateAndroidWidgets(events, profile, widget);
        // Deliberately NOT awaited — see `notifTimer` above.
        if (notifTimer) clearTimeout(notifTimer);
        notifTimer = setTimeout(() => {
          notifTimer = null;
          const s = get();
          rescheduleNotifications(s.events, s.profile, s.widget).catch(() => {});
        }, 1200);
      },

      clearDeleted(keys) {
        const gone = new Set(keys);
        set({ deletedKeys: get().deletedKeys.filter((k) => !gone.has(k)) });
      },

      setCloudCursor(cursor) {
        set({ cloudCursor: cursor });
      },

      // Apply server changes: add missing events, drop tombstoned ones, and
      // overwrite the profile snapshot when the server copy is newer. Never
      // re-adds a locally deleted event (deletedKeys wins).
      async mergeCloud({ addEvents, removeKeys, profile, widget, onboarded }) {
        const locallyDeleted = new Set(get().deletedKeys);
        const remove = new Set(removeKeys);
        const have = new Set(get().events.map(eventKey));

        let next = get().events.filter((e) => !remove.has(eventKey(e)));
        for (const e of addEvents) {
          const k = eventKey(e);
          if (remove.has(k) || locallyDeleted.has(k) || have.has(k)) continue;
          next.push(e);
          have.add(k);
        }
        next.sort((a, b) => a.at - b.at);

        // Never let a stale remote onboarded=false downgrade a finished local
        // session (race after "Refaire le questionnaire" + Terminer).
        const nextOnboarded =
          onboarded === undefined
            ? undefined
            : onboarded || get().onboarded;

        set({
          events: next,
          ...(profile ? { profile } : {}),
          ...(widget ? { widget: { ...get().widget, ...widget } } : {}),
          ...(nextOnboarded !== undefined ? { onboarded: nextOnboarded } : {}),
        });
        await get()._sync();
      },
    }),
    {
      name: 'hydra.v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        events: s.events,
        profile: s.profile,
        presets: s.presets,
        widget: s.widget,
        onboarded: s.onboarded,
        dataOwnerUserId: s.dataOwnerUserId,
        deletedKeys: s.deletedKeys,
        cloudCursor: s.cloudCursor,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.hydrated = true;
        // Read widget-logged events out of the App Group FIRST (pullFromWidget),
        // then push the merged snapshot back. Doing _sync() before the pull would
        // overwrite the snapshot and drop events the widget added while closed.
        state
          .pullFromWidget()
          .catch(() => {})
          .finally(() => {
            state._sync().catch(() => {});
          });
      },
    }
  )
);
