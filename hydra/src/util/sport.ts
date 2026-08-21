// Active sport session helpers (display layer — engine unchanged).
// Sport events start at log time; sweat accrues over [at, at + duration].

import {
  baseDrainMlPerHour,
  HydrationEvent,
  SportIntensity,
  sweatRateMlPerHour,
  UserProfile,
} from '../engine/hydrationEngine';
import type { StringKey } from '../i18n';

export interface ActiveSportSession {
  intensity: SportIntensity;
  durationMin: number;
  startedAt: number;
  endsAt: number;
  remainingSec: number;
  sweatMlPerHour: number;
}

export interface SportDrainSummary {
  passiveMlPerH: number;
  sweatMlPerH: number;
  totalMlPerH: number;
  factorVsRest: number;
}

export function activeSportSessions(
  events: HydrationEvent[],
  now: number,
  profile: UserProfile
): ActiveSportSession[] {
  const out: ActiveSportSession[] = [];
  for (const e of events) {
    if (e.type !== 'sport') continue;
    const endsAt = e.at + e.durationMin * 60_000;
    if (now < e.at || now >= endsAt) continue;
    out.push({
      intensity: e.intensity,
      durationMin: e.durationMin,
      startedAt: e.at,
      endsAt,
      remainingSec: Math.max(0, Math.ceil((endsAt - now) / 1000)),
      sweatMlPerHour: sweatRateMlPerHour(profile, e.intensity),
    });
  }
  return out.sort((a, b) => a.endsAt - b.endsAt);
}

export function sportDrainSummary(
  sessions: ActiveSportSession[],
  profile: UserProfile
): SportDrainSummary {
  const passiveMlPerH = baseDrainMlPerHour(profile);
  const sweatMlPerH = sessions.reduce((acc, s) => acc + s.sweatMlPerHour, 0);
  const totalMlPerH = passiveMlPerH + sweatMlPerH;
  const factorVsRest =
    passiveMlPerH > 0 ? totalMlPerH / passiveMlPerH : 1;
  return { passiveMlPerH, sweatMlPerH, totalMlPerH, factorVsRest };
}

export function formatSportRemaining(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

// Renvoie une CLÉ de traduction, pas un libellé : ce module est utilisé par des
// composants, qui doivent pouvoir re-rendre quand la langue change.
export function intensityKey(i: SportIntensity): StringKey {
  if (i === 'intense') return 'sport.intense';
  if (i === 'light') return 'sport.light';
  return 'sport.moderate';
}

export function hasActiveSportSession(
  events: HydrationEvent[],
  now: number,
  profile: UserProfile
): boolean {
  return activeSportSessions(events, now, profile).length > 0;
}
