import {
  alcoholNetMl,
  awakeHoursFromSleep,
  baseDrainMlPerHour,
  computeState,
  concentrationFactor,
  dailyNeedMl,
  DEFAULT_PROFILE,
  ethanolGrams,
  HydrationEvent,
  peakPoisonExtra,
  absorptionRecoveryAt,
  remainingAbsorptionMl,
  sweatRateMlPerHour,
  UserProfile,
  zoneOf,
} from './hydrationEngine';

// Fixed reference day — Monday 15 June 2026 — so tests are timezone-agnostic
// as long as we build wall-clock hours via new Date(...).
function ts(hour: number, minute = 0): number {
  return new Date(2026, 5, 15, hour, minute, 0, 0).getTime();
}

const P70: UserProfile = { ...DEFAULT_PROFILE, weightKg: 70, awakeHours: 16 };

// A tiny water log at t0 anchors the timeline. The starting level is already
// capped at the daily need, so this adds nothing measurable — it's just a
// t=0 marker so integration has a starting point.
function anchor(atMs: number): HydrationEvent {
  return { type: 'water', at: atMs, volumeMl: 1 };
}

describe('daily need', () => {
  it('70 kg → 2240 mL', () => {
    expect(dailyNeedMl(P70)).toBeCloseTo(2240, 6);
  });
  it('base drain 70 kg / 16h ≈ 140 mL/h', () => {
    expect(baseDrainMlPerHour(P70)).toBeCloseTo(140, 6);
  });
});

describe('#1 — passive drain over 2 h (70 kg, 16 h éveil)', () => {
  it('drops ~280 mL', () => {
    const events = [anchor(ts(10))];
    const before = computeState(events, ts(10), P70);
    const after = computeState(events, ts(12), P70);
    const drop = before.levelMl - after.levelMl;
    expect(drop).toBeGreaterThan(275);
    expect(drop).toBeLessThan(285);
  });
});

describe('#2 — sleep window ×0.4', () => {
  it('mid-sleep 2 h drains ~0.4× daytime 2 h', () => {
    const events = [anchor(ts(22))];
    // Daytime baseline: 10:00 → 12:00 elsewhere in the day.
    const dayEvents = [anchor(ts(10))];
    const dayDrop =
      computeState(dayEvents, ts(10), P70).levelMl -
      computeState(dayEvents, ts(12), P70).levelMl;
    // Sleep interval: 01:00 → 03:00 next day, wholly inside 23–07 window.
    const nightDrop =
      computeState(events, ts(24 + 1), P70).levelMl -
      computeState(events, ts(24 + 3), P70).levelMl;
    const ratio = nightDrop / dayDrop;
    expect(ratio).toBeGreaterThan(0.38);
    expect(ratio).toBeLessThan(0.42);
  });
});

describe('#3 — beer 500 mL / 5%', () => {
  it('net water balance is positive (~+416 mL — beer ≈ water)', () => {
    const net = alcoholNetMl(500, 5);
    // 475 mL water; ethanol 19.725 g × 10 × 0.3 (dilute gate) ≈ 59 mL loss; net ≈ +416.
    // The concentration gate keeps beer hydration-neutral-to-positive (BHI 2016).
    expect(net).toBeGreaterThan(405);
    expect(net).toBeLessThan(425);
  });
  it('poison peak is mild for beer (~×1.19) after the ABV gate', () => {
    const g = ethanolGrams(500, 5); // ≈ 19.7 g
    const extra = peakPoisonExtra(g, 5);
    expect(1 + extra).toBeGreaterThan(1.1);
    expect(1 + extra).toBeLessThan(1.3);
  });
  it('logs beer → poisoned=true, level not tanked', () => {
    const events: HydrationEvent[] = [
      anchor(ts(10)),
      { type: 'alcohol', at: ts(10, 1), volumeMl: 500, abv: 5 },
    ];
    const just = computeState(events, ts(10, 2), P70);
    expect(just.poisoned).toBe(true);
    // level should still be near capacity (2240) — beer is essentially neutral
    expect(just.levelMl).toBeGreaterThan(2200);
  });
});

describe('#4 — shot 40 mL / 40%', () => {
  it('net water balance is negative (~-102 mL)', () => {
    const net = alcoholNetMl(40, 40);
    expect(net).toBeLessThan(-95);
    expect(net).toBeGreaterThan(-115);
  });
  it('logs shot → poisoned=true, redAt closer than baseline', () => {
    const baseline: HydrationEvent[] = [anchor(ts(10))];
    const withShot: HydrationEvent[] = [
      anchor(ts(10)),
      { type: 'alcohol', at: ts(10, 1), volumeMl: 40, abv: 40 },
    ];
    const bBase = computeState(baseline, ts(10, 2), P70);
    const bShot = computeState(withShot, ts(10, 2), P70);
    expect(bShot.poisoned).toBe(true);
    // countdown shrinks (redAt earlier) because poison ×~1.4 speeds drain
    if (bBase.redAt && bShot.redAt) {
      expect(bShot.redAt).toBeLessThan(bBase.redAt);
    }
  });
});

describe('#4b — concentration gate: a shot outweighs a beer', () => {
  it('concentrationFactor ramps 0.3 (dilute) → 1.0 (spirits)', () => {
    expect(concentrationFactor(5)).toBeCloseTo(0.3, 5); // beer
    expect(concentrationFactor(8)).toBeCloseTo(0.3, 5); // low anchor
    expect(concentrationFactor(14)).toBeCloseTo(0.65, 2); // wine, mid-ramp
    expect(concentrationFactor(20)).toBeCloseTo(1.0, 5); // high anchor
    expect(concentrationFactor(40)).toBeCloseTo(1.0, 5); // spirits, capped
  });

  it('a shot poisons harder than a beer even with fewer ethanol grams', () => {
    // Beer (default LÉGER) packs slightly MORE ethanol than the shot, yet must
    // poison LESS — the gate keys on concentration, per Polhuis 2017.
    const beerG = ethanolGrams(400, 5); // ≈ 15.8 g
    const shotG = ethanolGrams(40, 40); // ≈ 12.6 g
    expect(beerG).toBeGreaterThan(shotG); // beer really does have more grams
    const beerPeak = peakPoisonExtra(beerG, 5);
    const shotPeak = peakPoisonExtra(shotG, 40);
    expect(shotPeak).toBeGreaterThan(beerPeak);
  });

  it('beer stays hydration-positive, shot goes negative', () => {
    expect(alcoholNetMl(400, 5)).toBeGreaterThan(0); // LÉGER ≈ +333
    expect(alcoholNetMl(40, 40)).toBeLessThan(0); // FORT ≈ −102
  });
});

describe('#5 — two drinks cumulate, capped ×3 / 4 h', () => {
  it('multiplier cumulates but never exceeds ×3', () => {
    // Four beers close together — deliberately overshoot to test the cap.
    const events: HydrationEvent[] = [
      anchor(ts(10)),
      { type: 'alcohol', at: ts(10, 5), volumeMl: 500, abv: 8 },  // ~31 g
      { type: 'alcohol', at: ts(10, 10), volumeMl: 500, abv: 8 },
      { type: 'alcohol', at: ts(10, 15), volumeMl: 500, abv: 8 },
      { type: 'alcohol', at: ts(10, 20), volumeMl: 500, abv: 8 },
    ];
    // Sample near a shared peak zone.
    const s = computeState(events, ts(12, 0), P70);
    expect(s.poisoned).toBe(true);
    expect(s.poisonMult).toBeLessThanOrEqual(3.0 + 1e-9);
  });

  it('poison window ends at last drink + 4 h', () => {
    const lastAt = ts(10, 30);
    const events: HydrationEvent[] = [
      anchor(ts(10)),
      { type: 'alcohol', at: ts(10, 5), volumeMl: 500, abv: 5 },
      { type: 'alcohol', at: lastAt, volumeMl: 500, abv: 5 },
    ];
    const beforeEnd = computeState(events, lastAt + 4 * 3600_000 - 60_000, P70);
    const afterEnd = computeState(events, lastAt + 4 * 3600_000 + 60_000, P70);
    expect(beforeEnd.poisoned).toBe(true);
    expect(afterEnd.poisoned).toBe(false);
  });
});

describe('awakeHoursFromSleep', () => {
  it('derives awake hours from the sleep window', () => {
    expect(awakeHoursFromSleep(23, 7)).toBe(16); // sleeps 8 h across midnight
    expect(awakeHoursFromSleep(0, 8)).toBe(16);
    expect(awakeHoursFromSleep(1, 7)).toBe(18); // sleeps 6 h
    expect(awakeHoursFromSleep(22, 6)).toBe(16);
  });

  it('start === end means no sleep window (24 h awake)', () => {
    expect(awakeHoursFromSleep(7, 7)).toBe(24);
  });
});

describe('#6 — sport (metabolic-heat sweat model)', () => {
  it('session starting now accrues sweat over the window', () => {
    const start = ts(10, 0);
    const events: HydrationEvent[] = [
      anchor(ts(10)),
      { type: 'sport', at: start, durationMin: 45, intensity: 'moderate' },
    ];
    const atStart = computeState(events, start, P70);
    const mid = computeState(events, start + 22 * 60_000, P70);
    const atEnd = computeState(events, start + 45 * 60_000, P70);
    expect(atStart.levelPct).toBeGreaterThan(mid.levelPct);
    expect(mid.levelPct).toBeGreaterThan(atEnd.levelPct);
  });

  it('moderate 60 min → 70 kg male loses ~800 mL (calibration anchor)', () => {
    const events: HydrationEvent[] = [
      anchor(ts(10)),
      { type: 'sport', at: ts(10, 1), durationMin: 60, intensity: 'moderate' },
    ];
    const before = computeState(events, ts(10, 1), P70);
    const after = computeState(events, ts(11, 1), P70);
    const sportLoss =
      before.levelMl - after.levelMl - baseDrainMlPerHour(P70); // subtract 1h passive drain
    expect(sportLoss).toBeGreaterThan(780);
    expect(sportLoss).toBeLessThan(820);
  });

  it('female residual is ~10 % below male at matched mass/intensity', () => {
    const F70: UserProfile = { ...P70, sex: 'female' };
    const male = sweatRateMlPerHour(P70, 'moderate');
    const female = sweatRateMlPerHour(F70, 'moderate');
    expect(female / male).toBeCloseTo(0.9, 5);
  });

  it('sweat scales with body mass (90 kg > 70 kg > 60 kg)', () => {
    const p60: UserProfile = { ...P70, weightKg: 60 };
    const p90: UserProfile = { ...P70, weightKg: 90 };
    const s60 = sweatRateMlPerHour(p60, 'moderate');
    const s70 = sweatRateMlPerHour(P70, 'moderate');
    const s90 = sweatRateMlPerHour(p90, 'moderate');
    expect(s90).toBeGreaterThan(s70);
    expect(s70).toBeGreaterThan(s60);
    // linear in mass: 90/70 ratio ≈ 1.286
    expect(s90 / s70).toBeCloseTo(90 / 70, 5);
  });

  it('intensity ordering: intense > moderate > light', () => {
    expect(sweatRateMlPerHour(P70, 'intense')).toBeGreaterThan(
      sweatRateMlPerHour(P70, 'moderate')
    );
    expect(sweatRateMlPerHour(P70, 'moderate')).toBeGreaterThan(
      sweatRateMlPerHour(P70, 'light')
    );
  });

  it('heat and humidity raise the sweat rate', () => {
    const hot: UserProfile = { ...P70, ambientTempC: 33 };
    const humid: UserProfile = { ...P70, relativeHumidityPct: 85 };
    expect(sweatRateMlPerHour(hot, 'moderate')).toBeGreaterThan(
      sweatRateMlPerHour(P70, 'moderate')
    );
    expect(sweatRateMlPerHour(humid, 'moderate')).toBeGreaterThan(
      sweatRateMlPerHour(P70, 'moderate')
    );
  });

  it('sweatRate direct lookup matches calibration', () => {
    const F70: UserProfile = { ...P70, sex: 'female' };
    expect(sweatRateMlPerHour(P70, 'moderate')).toBeCloseTo(800.8, 1);
    expect(sweatRateMlPerHour(F70, 'moderate')).toBeCloseTo(720.72, 1);
    expect(sweatRateMlPerHour(P70, 'light')).toBeCloseTo(400.4, 1);
    expect(sweatRateMlPerHour(P70, 'intense')).toBeCloseTo(1151.15, 1);
  });
});

describe('#7 — ambient temp > 30 °C', () => {
  it('base drain ×1.4', () => {
    const cool: UserProfile = { ...P70, ambientTempC: null };
    const hot: UserProfile = { ...P70, ambientTempC: 32 };
    const events = [anchor(ts(10))];
    const coolDrop =
      computeState(events, ts(10), cool).levelMl -
      computeState(events, ts(11), cool).levelMl;
    const hotDrop =
      computeState(events, ts(10), hot).levelMl -
      computeState(events, ts(11), hot).levelMl;
    const ratio = hotDrop / coolDrop;
    expect(ratio).toBeGreaterThan(1.38);
    expect(ratio).toBeLessThan(1.42);
  });
});

describe('#8 — force-quit / incremental recompute is stable', () => {
  it('level at t3 identical whether computed in one shot or step by step', () => {
    const events: HydrationEvent[] = [
      anchor(ts(8)),
      { type: 'water', at: ts(9, 15), volumeMl: 300 },
      { type: 'alcohol', at: ts(10, 30), volumeMl: 500, abv: 5 },
      { type: 'water', at: ts(11), volumeMl: 250 },
      { type: 'sport', at: ts(12), durationMin: 45, intensity: 'moderate' },
    ];
    const target = ts(14, 0);
    const oneShot = computeState(events, target, P70);
    // Sample every 15 minutes leading up to `target` — the engine must
    // yield the same final state at `target` regardless of whether we
    // polled it in between (function is pure, but this exercises the
    // "force-quit and reopen 2h later" contract from the spec).
    let stepped;
    for (let t = ts(8); t <= target; t += 15 * 60_000) {
      stepped = computeState(events, t, P70);
    }
    stepped = computeState(events, target, P70);
    expect(stepped!.levelMl).toBeCloseTo(oneShot.levelMl, 6);
  });
});

describe('zone thresholds', () => {
  it('zoneOf classifies correctly', () => {
    expect(zoneOf(80, false)).toBe('green');
    expect(zoneOf(55, false)).toBe('amber');
    expect(zoneOf(25, false)).toBe('amber');
    expect(zoneOf(24, false)).toBe('red');
    expect(zoneOf(80, true)).toBe('poison');
  });
});

describe('water absorption cap (~1000 mL / rolling hour)', () => {
  it('a single 2 L chug only credits ~1000 mL to the bar', () => {
    // Drain a big deficit first so there is room, then chug 2 L at once.
    const events: HydrationEvent[] = [
      { type: 'water', at: ts(6), volumeMl: 1 }, // anchor early, drain down
      { type: 'water', at: ts(12), volumeMl: 2000 },
    ];
    const before = computeState(events, ts(12), P70); // just before the chug is applied? it's applied at ts(12)
    // Right after the chug: level rose by at most the cap (1000), not 2000.
    const after = computeState(events, ts(12, 0), P70);
    expect(after.absorbedLastHourMl).toBeLessThanOrEqual(1000 + 1e-6);
    expect(after.saturated).toBe(true);
    // The excess 1000 mL is overflow — not stored.
    expect(after.levelMl).toBeLessThan(P70.weightKg * 32 + 1);
  });

  it('same 2 L split into 4×500 over 4 h is fully credited', () => {
    const chug: HydrationEvent[] = [
      { type: 'water', at: ts(8), volumeMl: 2000 },
    ];
    const spread: HydrationEvent[] = [
      { type: 'water', at: ts(8), volumeMl: 500 },
      { type: 'water', at: ts(9), volumeMl: 500 },
      { type: 'water', at: ts(10), volumeMl: 500 },
      { type: 'water', at: ts(11), volumeMl: 500 },
    ];
    // Compare credited water in each hour: spread never exceeds the cap and
    // so every mL counts, chug loses half to overflow.
    const chugState = computeState(chug, ts(8), P70);
    expect(chugState.absorbedLastHourMl).toBeLessThanOrEqual(1000 + 1e-6);
    const spreadLast = computeState(spread, ts(11), P70);
    expect(spreadLast.absorbedLastHourMl).toBeCloseTo(500, 0);
  });

  it('remainingAbsorptionMl drops after drinking and refills over an hour', () => {
    const events: HydrationEvent[] = [{ type: 'water', at: ts(10), volumeMl: 800 }];
    expect(remainingAbsorptionMl(events, ts(10, 1))).toBeCloseTo(200, 0);
    // an hour later the window has rolled past → full capacity again
    expect(remainingAbsorptionMl(events, ts(11, 1))).toBeCloseTo(1000, 0);
  });

  it("alcohol's water counts toward the absorption cap", () => {
    // A 1 L beer floods the gut like 1 L of water: it should consume ~950 mL
    // (its water fraction) of the hourly absorption budget.
    const events: HydrationEvent[] = [
      { type: 'water', at: ts(8), volumeMl: 1 }, // anchor + drain room
      { type: 'alcohol', at: ts(20), volumeMl: 1000, abv: 5 },
    ];
    expect(remainingAbsorptionMl(events, ts(20, 1))).toBeLessThan(100);
  });

  it('a drink taken while already saturated cannot add water (net ≤ 0)', () => {
    // Saturate the hour with 1 L water, then a beer 1 min later: its water is
    // fully capped out, so only the diuresis remains → the bar can only drop.
    const base: HydrationEvent[] = [{ type: 'water', at: ts(20), volumeMl: 1000 }];
    const withBeer: HydrationEvent[] = [
      ...base,
      { type: 'alcohol', at: ts(20, 1), volumeMl: 400, abv: 5 },
    ];
    const before = computeState(base, ts(20, 1), P70).levelMl;
    const after = computeState(withBeer, ts(20, 1), P70).levelMl;
    expect(after).toBeLessThan(before); // saturated → beer is a net loss
  });

  it('the same beer with free capacity is a net gain', () => {
    const base: HydrationEvent[] = [{ type: 'water', at: ts(8), volumeMl: 1 }];
    const withBeer: HydrationEvent[] = [
      ...base,
      { type: 'alcohol', at: ts(20), volumeMl: 400, abv: 5 },
    ];
    const before = computeState(base, ts(20), P70).levelMl;
    const after = computeState(withBeer, ts(20), P70).levelMl;
    expect(after).toBeGreaterThan(before); // capacity available → beer hydrates
  });
});

describe('absorptionRecoveryAt (when can I drink again?)', () => {
  it('returns null when there is still room to drink', () => {
    const events: HydrationEvent[] = [{ type: 'water', at: ts(10), volumeMl: 500 }];
    // 500 of 1000 used → 500 free, well above the 30 mL threshold.
    expect(absorptionRecoveryAt(events, ts(10, 1))).toBeNull();
  });

  it('when saturated, points to when the oldest drink ages out of the hour', () => {
    // A single 1 L chug saturates the window; capacity only returns when that
    // drink leaves the rolling hour, i.e. exactly one hour after it was logged.
    const events: HydrationEvent[] = [{ type: 'water', at: ts(10), volumeMl: 1000 }];
    const recover = absorptionRecoveryAt(events, ts(10, 1));
    expect(recover).toBe(ts(10) + 3_600_000); // ts(11)
    // …and once that instant passes there is room again.
    expect(absorptionRecoveryAt(events, ts(11, 1))).toBeNull();
  });

  it('with staggered drinks, recovery comes from the oldest, not the newest', () => {
    // 700 mL at 10:00, 300 mL at 10:30 → saturated at 10:31. Freeing the 10:00
    // drink (at 11:00) drops usage by 700, leaving only 300 used → room again.
    const events: HydrationEvent[] = [
      { type: 'water', at: ts(10), volumeMl: 700 },
      { type: 'water', at: ts(10, 30), volumeMl: 300 },
    ];
    expect(absorptionRecoveryAt(events, ts(10, 31))).toBe(ts(10) + 3_600_000);
  });
});

describe('weight scales daily need', () => {
  it('90 kg profile has larger need and larger drain than 70 kg', () => {
    const P90 = { ...P70, weightKg: 90 };
    expect(dailyNeedMl(P90)).toBe(90 * 32);
    expect(baseDrainMlPerHour(P90)).toBeGreaterThan(baseDrainMlPerHour(P70));
  });
});

describe('initialLevelPct (onboarding calibration)', () => {
  it('defaults to 100 % when unset (legacy)', () => {
    const s = computeState([], ts(12), P70);
    expect(s.levelPct).toBe(100);
    expect(s.zone).toBe('green');
  });

  it('empty log respects onboarding feeling percentages', () => {
    const at55 = computeState([], ts(12), { ...P70, initialLevelPct: 55 });
    expect(Math.round(at55.levelPct)).toBe(55);
    expect(at55.zone).toBe('amber');

    const at35 = computeState([], ts(12), { ...P70, initialLevelPct: 35 });
    expect(Math.round(at35.levelPct)).toBe(35);
    expect(at35.zone).toBe('amber');

    const at20 = computeState([], ts(12), { ...P70, initialLevelPct: 20 });
    expect(Math.round(at20.levelPct)).toBe(20);
    expect(at20.zone).toBe('red');
  });

  it('profile event patch sets the anchor for subsequent drinks', () => {
    const events: HydrationEvent[] = [
      {
        type: 'profile',
        at: ts(8),
        patch: { initialLevelPct: 35 },
      },
    ];
    const s = computeState(events, ts(8), P70);
    expect(Math.round(s.levelPct)).toBe(35);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Régression : un verre bu à barre vide doit se voir.
//
// Signalé depuis l'app : barre à 0 %, un appui sur EAU, rien ne bouge — mais
// l'écran DONNÉES compte bien +0,5 L. Les deux sont d'accord, c'est le niveau
// qui était faux : la perte intégrée entre deux événements n'était bornée
// nulle part, donc quelqu'un qui n'avait pas bu depuis 20 h accumulait une
// « dette » de plusieurs litres sous le zéro affiché. Le verre suivant
// remboursait cette dette au lieu de remplir la barre.
// ─────────────────────────────────────────────────────────────────────────────
describe('#R1 — un verre à barre vide remonte le niveau', () => {
  // Un seul verre au réveil, puis plus rien pendant 20 h : la barre est à 0.
  const events: HydrationEvent[] = [
    { type: 'water', at: ts(7), volumeMl: 250 },
  ];
  const emptyAt = ts(7) + 20 * 3600_000;

  it('la barre est bien vide avant le verre', () => {
    expect(computeState(events, emptyAt, P70).levelPct).toBe(0);
  });

  it('le verre suivant fait remonter la barre', () => {
    const after: HydrationEvent[] = [
      ...events,
      { type: 'water', at: emptyAt, volumeMl: 500 },
    ];
    const state = computeState(after, emptyAt + 1000, P70);
    expect(state.levelMl).toBeGreaterThan(400);
    expect(state.levelPct).toBeGreaterThan(0);
  });

  it('le niveau ne descend jamais sous zéro, même après plusieurs jours à sec', () => {
    const state = computeState(events, ts(7) + 5 * 24 * 3600_000, P70);
    expect(state.levelMl).toBe(0);
    const after = computeState(
      [...events, { type: 'water', at: ts(7) + 5 * 24 * 3600_000, volumeMl: 500 }],
      ts(7) + 5 * 24 * 3600_000 + 1000,
      P70
    );
    expect(after.levelMl).toBeGreaterThan(400);
  });
});
