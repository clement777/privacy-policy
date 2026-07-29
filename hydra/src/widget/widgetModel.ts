import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  computeState,
  DEFAULT_PROFILE,
  displayLevelPct,
  HydrationEvent,
  HydrationState,
  remainingAbsorptionMl,
  UserProfile,
} from '../engine/hydrationEngine';
import {
  DEFAULT_WIDGET_SETTINGS,
  WidgetSettings,
} from '../store/widgetSettings';

// The Android home-screen widget renders in a headless JS context (via
// react-native-android-widget's task handler). It has no access to the Zustand
// store, so it reads the exact same persisted blob the app writes. Keeping the
// key + shape in sync with src/store/useHydration.ts is the contract here.
const PERSIST_KEY = 'hydra.v2';

interface PersistedShape {
  state?: {
    events?: HydrationEvent[];
    profile?: UserProfile;
    widget?: WidgetSettings;
  };
  version?: number;
}

export interface PersistedSlice {
  events: HydrationEvent[];
  profile: UserProfile;
  widget: WidgetSettings;
}

export async function readPersistedSlice(): Promise<PersistedSlice> {
  try {
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    if (!raw) return emptySlice();
    const parsed = JSON.parse(raw) as PersistedShape;
    return {
      events: parsed.state?.events ?? [],
      profile: parsed.state?.profile ?? DEFAULT_PROFILE,
      widget: parsed.state?.widget ?? DEFAULT_WIDGET_SETTINGS,
    };
  } catch {
    return emptySlice();
  }
}

function emptySlice(): PersistedSlice {
  return {
    events: [],
    profile: DEFAULT_PROFILE,
    widget: DEFAULT_WIDGET_SETTINGS,
  };
}

// Append a water event straight into the persisted blob, so tapping "+ EAU" on
// the widget works even when the app is closed. Respects the same absorption
// saturation guard as the app (you can't drink faster than you absorb).
export async function logWaterFromWidget(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as PersistedShape;
    if (!parsed.state) return;
    const events = parsed.state.events ?? [];
    const widget = parsed.state.widget ?? DEFAULT_WIDGET_SETTINGS;
    const at = Date.now();
    if (remainingAbsorptionMl(events, at) < 30) return; // saturated: ignore tap
    parsed.state.events = [
      ...events,
      { type: 'water', at, volumeMl: widget.defaultWaterMl },
    ];
    await AsyncStorage.setItem(PERSIST_KEY, JSON.stringify(parsed));
  } catch {
    // best-effort; never crash the widget task
  }
}

// Alcohol presets mirror the native iOS widget buttons (HydraWidget.swift).
export const WIDGET_ALCOHOL = {
  ADD_ALC_LIGHT: { volumeMl: 400, abv: 5 },
  ADD_ALC_MED: { volumeMl: 150, abv: 14 },
  ADD_ALC_STRONG: { volumeMl: 40, abv: 40 },
} as const;

export type AlcoholAction = keyof typeof WIDGET_ALCOHOL;

export async function logAlcoholFromWidget(action: AlcoholAction): Promise<void> {
  const preset = WIDGET_ALCOHOL[action];
  if (!preset) return;
  try {
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as PersistedShape;
    if (!parsed.state) return;
    const events = parsed.state.events ?? [];
    parsed.state.events = [
      ...events,
      {
        type: 'alcohol',
        at: Date.now(),
        volumeMl: preset.volumeMl,
        abv: preset.abv,
      },
    ];
    await AsyncStorage.setItem(PERSIST_KEY, JSON.stringify(parsed));
  } catch {
    // best-effort
  }
}

export type WidgetVariant = 'small' | 'medium';

export interface WidgetModel {
  pct: number;
  zoneColor: string;
  statusLabel: string;
  countdownLabel: string;
  dailyNeedMl: number;
  filledSegments: number;
  waterLabel: string;
  showAlcohol: boolean;
}

export const WIDGET_SEGMENTS = 14;

const ZONE_COLORS: Record<HydrationState['zone'], string> = {
  green: '#3EE07A',
  amber: '#FFB020',
  red: '#FF3B4A',
  poison: '#B44CFF',
};

function statusLabel(s: HydrationState): string {
  if (s.poisoned) return 'EMPOISONNÉ';
  if (s.zone === 'red') return 'CRITIQUE';
  if (s.zone === 'amber') return 'TU SÈCHES';
  return 'HYDRATÉ';
}

function countdownLabel(s: HydrationState, now: number): string {
  if (s.redAt == null) return '—';
  const secs = s.redAt / 1000 - now / 1000;
  if (secs <= 0) return 'ROUGE';
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  return h > 0 ? `→ ${h}h${String(m).padStart(2, '0')}` : `→ ${m}min`;
}

export function buildWidgetModel(
  slice: PersistedSlice,
  now: number = Date.now()
): WidgetModel {
  const state = computeState(slice.events, now, slice.profile);
  const pct = displayLevelPct(state.levelPct);
  return {
    pct,
    zoneColor: ZONE_COLORS[state.zone],
    statusLabel: statusLabel(state),
    countdownLabel: countdownLabel(state, now),
    dailyNeedMl: Math.round(state.dailyNeedMl),
    filledSegments: Math.max(
      0,
      Math.min(WIDGET_SEGMENTS, Math.round((pct / 100) * WIDGET_SEGMENTS))
    ),
    waterLabel: `＋ EAU · ${slice.widget.defaultWaterMl} mL`,
    showAlcohol: slice.widget.showAlcoholOnMedium,
  };
}
