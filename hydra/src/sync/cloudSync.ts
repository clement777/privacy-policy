// Offline-first cloud sync. The local zustand store (useHydration) stays the
// source of truth; this pushes local changes to Supabase and pulls remote ones,
// merging idempotently. Wiring only — the physiology engine is untouched.
//
// Design (see backend/README.md):
//   • events: idempotent upsert keyed by (user_id, client_id = `${type}_${at}`).
//   • deletions: soft-delete (deleted_at) so they propagate across devices.
//   • profile: last-write-wins snapshot in the `profiles` row.
//   • pull: delta by `updated_at` cursor.

import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { HydrationEvent, SportIntensity, UserProfile } from '../engine/hydrationEngine';
import { WidgetSettings } from '../store/widgetSettings';
import { eventKey, useHydration } from '../store/useHydration';
import { useAuth } from '../store/useAuth';

// ── mapping ────────────────────────────────────────────────────────────────

type EventRow = {
  user_id: string;
  client_id: string;
  type: HydrationEvent['type'];
  at: string;
  volume_ml: number | null;
  abv: number | null;
  caffeine_mg: number | null;
  duration_min: number | null;
  intensity: string | null;
  patch: unknown;
  deleted_at: string | null;
  updated_at?: string;
};

function eventToRow(userId: string, e: HydrationEvent): EventRow {
  const row: EventRow = {
    user_id: userId,
    client_id: eventKey(e),
    type: e.type,
    at: new Date(e.at).toISOString(),
    volume_ml: null,
    abv: null,
    caffeine_mg: null,
    duration_min: null,
    intensity: null,
    patch: null,
    deleted_at: null,
  };
  if (e.type === 'water' || e.type === 'electrolytes') row.volume_ml = e.volumeMl;
  else if (e.type === 'alcohol') { row.volume_ml = e.volumeMl; row.abv = e.abv; }
  else if (e.type === 'caffeine') { row.volume_ml = e.volumeMl; row.caffeine_mg = e.caffeineMg ?? null; }
  else if (e.type === 'sport') { row.duration_min = e.durationMin; row.intensity = e.intensity; }
  else if (e.type === 'profile') row.patch = e.patch;
  return row;
}

function rowToEvent(r: EventRow): HydrationEvent | null {
  const at = new Date(r.at).getTime();
  switch (r.type) {
    case 'water': return { type: 'water', at, volumeMl: Number(r.volume_ml) };
    case 'electrolytes': return { type: 'electrolytes', at, volumeMl: Number(r.volume_ml) };
    case 'alcohol': return { type: 'alcohol', at, volumeMl: Number(r.volume_ml), abv: Number(r.abv) };
    case 'caffeine': return { type: 'caffeine', at, volumeMl: Number(r.volume_ml), caffeineMg: r.caffeine_mg == null ? undefined : Number(r.caffeine_mg) };
    case 'sport': return { type: 'sport', at, durationMin: Number(r.duration_min), intensity: (r.intensity as SportIntensity) ?? 'moderate' };
    case 'profile': return { type: 'profile', at, patch: (r.patch as Partial<UserProfile>) ?? {} };
    default: return null;
  }
}

type ProfileRow = {
  user_id: string;
  weight_kg: number | null;
  sex: 'male' | 'female' | null;
  sleep_start_hour: number | null;
  sleep_end_hour: number | null;
  awake_hours: number | null;
  ambient_temp_c: number | null;
  relative_humidity_pct: number | null;
  altitude_m: number | null;
  daily_goal_override_ml: number | null;
  default_water_ml: number | null;
  widget: WidgetSettings | Record<string, never> | null;
  onboarded: boolean | null;
  platform: string | null;
  updated_at?: string;
};

function profileToRow(
  userId: string,
  p: UserProfile,
  widget: WidgetSettings,
  onboarded: boolean
): ProfileRow {
  return {
    user_id: userId,
    weight_kg: p.weightKg,
    sex: p.sex,
    sleep_start_hour: p.sleepStartHour,
    sleep_end_hour: p.sleepEndHour,
    awake_hours: p.awakeHours,
    ambient_temp_c: p.ambientTempC ?? null,
    relative_humidity_pct: p.relativeHumidityPct ?? null,
    altitude_m: p.altitudeM,
    daily_goal_override_ml: p.dailyGoalOverrideMl ?? null,
    default_water_ml: widget.defaultWaterMl,
    widget,
    onboarded,
    platform: Platform.OS,
  };
}

function rowToProfile(r: ProfileRow): UserProfile | null {
  // The signup trigger seeds an all-null row; only apply once it carries real
  // data (weight set), so a fresh remote row never clobbers a local profile.
  if (r.weight_kg == null || r.sex == null) return null;
  return {
    weightKg: Number(r.weight_kg),
    sex: r.sex,
    sleepStartHour: Number(r.sleep_start_hour ?? 23),
    sleepEndHour: Number(r.sleep_end_hour ?? 7),
    awakeHours: Number(r.awake_hours ?? 16),
    ambientTempC: r.ambient_temp_c == null ? null : Number(r.ambient_temp_c),
    relativeHumidityPct: r.relative_humidity_pct == null ? null : Number(r.relative_humidity_pct),
    altitudeM: Number(r.altitude_m ?? 0),
    dailyGoalOverrideMl: r.daily_goal_override_ml == null ? null : Number(r.daily_goal_override_ml),
    // Not in the profiles table yet — kept via the onboarding profile event patch.
    initialLevelPct: null,
  };
}

// ── push / pull ──────────────────────────────────────────────────────────────

async function pushLocal(userId: string): Promise<void> {
  const s = useHydration.getState();

  // Profile snapshot (row exists via signup trigger; upsert covers races).
  await supabase
    .from('profiles')
    .upsert(profileToRow(userId, s.profile, s.widget, s.onboarded), {
      onConflict: 'user_id',
    });

  // Events (idempotent). Personal data volume is small; upsert them all.
  if (s.events.length > 0) {
    await supabase
      .from('events')
      .upsert(s.events.map((e) => eventToRow(userId, e)), {
        onConflict: 'user_id,client_id',
      });
  }

  // Tombstones → soft-delete on the server, then clear the pushed ones.
  const keys = [...s.deletedKeys];
  if (keys.length > 0) {
    const { error } = await supabase
      .from('events')
      .update({ deleted_at: new Date().toISOString() })
      .in('client_id', keys)
      .eq('user_id', userId);
    if (!error) useHydration.getState().clearDeleted(keys);
  }
}

async function pullRemote(userId: string): Promise<void> {
  const cursor = useHydration.getState().cloudCursor ?? '1970-01-01T00:00:00Z';

  const { data: rows, error } = await supabase
    .from('events')
    .select('*')
    .gt('updated_at', cursor)
    .order('updated_at', { ascending: true });
  if (error) throw error;

  const addEvents: HydrationEvent[] = [];
  const removeKeys: string[] = [];
  let newCursor = useHydration.getState().cloudCursor;
  for (const r of (rows ?? []) as EventRow[]) {
    if (r.updated_at && (!newCursor || r.updated_at > newCursor)) newCursor = r.updated_at;
    if (r.deleted_at) {
      removeKeys.push(r.client_id);
    } else {
      const e = rowToEvent(r);
      if (e) addEvents.push(e);
    }
  }

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const remoteProfile = profileRow ? rowToProfile(profileRow as ProfileRow) : null;
  const pr = profileRow as ProfileRow | null;

  await useHydration.getState().mergeCloud({
    addEvents,
    removeKeys,
    profile: remoteProfile ?? undefined,
    widget: pr && pr.widget && typeof pr.widget === 'object' && 'preferredFormat' in pr.widget
      ? (pr.widget as WidgetSettings)
      : undefined,
    onboarded: pr?.onboarded ?? undefined,
  });

  if (newCursor) useHydration.getState().setCloudCursor(newCursor);
}

// ── coordinator ──────────────────────────────────────────────────────────────

let syncing = false;
let pendingAgain = false;

// Decide whether local data may be pushed for this user. Anonymous onboarding
// (owner null + onboarded) is claimed and pushed; any other mismatch wipes
// local first and pulls only — never contaminate B with A's bar.
async function prepareSyncForUser(
  userId: string
): Promise<'push-then-pull' | 'pull-only'> {
  const s = useHydration.getState();
  const owner = s.dataOwnerUserId;

  if (owner === userId) return 'push-then-pull';

  // Just finished the questionnaire while signed out → this account inherits it.
  if (owner == null && s.onboarded) {
    s.claimDataOwner(userId);
    return 'push-then-pull';
  }

  // Different account, or signing into an existing account on a clean device.
  await s.resetLocalData();
  useHydration.getState().claimDataOwner(userId);
  return 'pull-only';
}

export async function syncNow(): Promise<void> {
  const { status, user } = useAuth.getState();
  if (status !== 'signedIn' || !user) return;
  if (syncing) { pendingAgain = true; return; }
  syncing = true;
  try {
    const mode = await prepareSyncForUser(user.id);
    if (mode === 'push-then-pull') {
      await pushLocal(user.id);
      await pullRemote(user.id);
    } else {
      await pullRemote(user.id);
    }
  } catch {
    // Offline / transient — local store is intact; next trigger retries.
  } finally {
    syncing = false;
    if (pendingAgain) { pendingAgain = false; void syncNow(); }
  }
}

let debounce: ReturnType<typeof setTimeout> | null = null;
function scheduleSync(): void {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => { void syncNow(); }, 1500);
}

let started = false;
// Call once after auth init. Syncs on sign-in and (debounced) on local changes.
export function startSync(): () => void {
  if (started) return () => {};
  started = true;

  const unsubAuth = useAuth.subscribe((s, prev) => {
    if (s.status === 'signedIn' && prev.status !== 'signedIn') void syncNow();
  });

  let lastEvents = useHydration.getState().events;
  let lastProfile = useHydration.getState().profile;
  const unsubStore = useHydration.subscribe((s) => {
    if (s.events !== lastEvents || s.profile !== lastProfile) {
      lastEvents = s.events;
      lastProfile = s.profile;
      if (useAuth.getState().status === 'signedIn') scheduleSync();
    }
  });

  if (useAuth.getState().status === 'signedIn') void syncNow();

  return () => {
    unsubAuth();
    unsubStore();
    started = false;
  };
}
