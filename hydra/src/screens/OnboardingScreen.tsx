import React, { useEffect, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, FONTS, RADIUS } from '../theme/colors';
import { awakeHoursFromSleep, FEELING_LEVEL_PCT, FeelingKey, ML_PER_KG_DAY, Sex } from '../engine/hydrationEngine';
import { useHydration } from '../store/useHydration';
import { track, EV } from '../analytics/analytics';
import { WATER_CONTAINERS } from '../store/widgetSettings';
import { StringKey, useT } from '../i18n';
import { LanguagePicker } from '../components/LanguagePicker';

// Chaque étape porte une CLÉ stable en plus de son titre traduit.
//
// C'est la clé qui part dans PostHog. Sans elle, le même abandon serait compté
// sous « ÉTAT » pour un francophone et sous « STATE » pour un anglophone : le
// tunnel se scinderait en deux au premier utilisateur étranger, et la mesure
// qui a coûté le plus cher à mettre en place deviendrait illisible.
const STEPS: readonly { key: string; title: StringKey }[] = [
  { key: 'language', title: 'onb.step.language' },
  { key: 'welcome', title: 'onb.step.welcome' },
  { key: 'you', title: 'onb.step.you' },
  { key: 'rhythm', title: 'onb.step.rhythm' },
  { key: 'environment', title: 'onb.step.environment' },
  { key: 'water', title: 'onb.step.water' },
  { key: 'state', title: 'onb.step.state' },
  { key: 'recap', title: 'onb.step.recap' },
];

const FEELING_OPTIONS: {
  key: FeelingKey;
  label: StringKey;
  hint: StringKey;
  pct: number;
}[] = [
  {
    key: 'good',
    label: 'onb.feeling.good',
    hint: 'onb.feeling.good.hint',
    pct: FEELING_LEVEL_PCT.good,
  },
  {
    key: 'ok',
    label: 'onb.feeling.ok',
    hint: 'onb.feeling.ok.hint',
    pct: FEELING_LEVEL_PCT.ok,
  },
  {
    key: 'dry',
    label: 'onb.feeling.dry',
    hint: 'onb.feeling.dry.hint',
    pct: FEELING_LEVEL_PCT.dry,
  },
];

const LAST = STEPS.length - 1;

function tap() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

function Stepper({
  value,
  min,
  max,
  step = 1,
  unit,
  format,
  wrap = false,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  format?: (v: number) => string;
  /** 0–23 hours: + at 23 → 0, − at 0 → 23 */
  wrap?: boolean;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const next = (delta: number) => {
    if (wrap) {
      const span = max - min + 1;
      const n = value - min + delta;
      return min + ((((n % span) + span) % span) | 0);
    }
    return clamp(value + delta);
  };
  const dec = () => {
    tap();
    onChange(next(-step));
  };
  const inc = () => {
    tap();
    onChange(next(step));
  };
  const atMin = !wrap && value <= min;
  const atMax = !wrap && value >= max;
  return (
    <View style={styles.stepper}>
      <Pressable
        style={[styles.stepBtn, atMin && styles.stepBtnOff]}
        onPress={dec}
        disabled={atMin}
      >
        <Text style={styles.stepBtnTxt}>−</Text>
      </Pressable>
      <View style={styles.stepValueWrap}>
        <Text style={styles.stepValue}>{format ? format(value) : value}</Text>
        {unit ? <Text style={styles.stepUnit}>{unit}</Text> : null}
      </View>
      <Pressable
        style={[styles.stepBtn, atMax && styles.stepBtnOff]}
        onPress={inc}
        disabled={atMax}
      >
        <Text style={styles.stepBtnTxt}>+</Text>
      </Pressable>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const hourFmt = (h: number) => `${h}h`;

export function OnboardingScreen({
  onHaveAccount,
  onSignOut,
}: {
  // Set only when signed OUT — a sign-in shortcut shown to an already
  // authenticated user cannot navigate anywhere and reads as a dead button.
  onHaveAccount?: () => void;
  // Set only when signed IN: an account with no cloud profile legitimately
  // lands here, and needs an exit toward a different account.
  onSignOut?: () => void;
} = {}) {
  const { profile, widget, completeOnboarding } = useHydration();
  const tr = useT();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);

  // Un événement par étape affichée. C'est cette suite qui dira laquelle des
  // questions fait décrocher — aujourd'hui on sait seulement que 93 personnes
  // sur 100 n'arrivent jamais à l'essai, sans savoir où elles s'arrêtent.
  useEffect(() => {
    track(EV.onboardingStep, { index: step, title: STEPS[step].key });
  }, [step]);

  useEffect(() => {
    track(EV.onboardingStarted);
  }, []);

  const [sex, setSex] = useState<Sex>(profile.sex);
  const [weightKg, setWeightKg] = useState(profile.weightKg);
  const [sleepStartHour, setSleepStartHour] = useState(profile.sleepStartHour);
  const [sleepEndHour, setSleepEndHour] = useState(profile.sleepEndHour);
  const [envOn, setEnvOn] = useState(
    profile.ambientTempC != null || profile.relativeHumidityPct != null
  );
  const [ambientTempC, setAmbientTempC] = useState(profile.ambientTempC ?? 20);
  const [relativeHumidityPct, setRelativeHumidityPct] = useState(
    profile.relativeHumidityPct ?? 50
  );
  const [altitudeM, setAltitudeM] = useState(profile.altitudeM);
  const [defaultWaterMl, setDefaultWaterMl] = useState(widget.defaultWaterMl);
  const isPreset = WATER_CONTAINERS.some((c) => c.ml === widget.defaultWaterMl);
  const [customMode, setCustomMode] = useState(!isPreset);
  const [customMl, setCustomMl] = useState(String(widget.defaultWaterMl));
  const [feeling, setFeeling] = useState<FeelingKey>('ok');

  const feelingLabel = tr(
    FEELING_OPTIONS.find((o) => o.key === feeling)?.label ?? 'onb.feeling.ok'
  );

  const need = Math.round(weightKg * ML_PER_KG_DAY);
  const awakeHours = awakeHoursFromSleep(sleepStartHour, sleepEndHour);
  const sleepHours = 24 - awakeHours;

  const CUSTOM_MIN = 50;
  const CUSTOM_MAX = 2000;
  const clampMl = (v: number) =>
    Math.max(CUSTOM_MIN, Math.min(CUSTOM_MAX, Math.round(v)));

  const selectPreset = (ml: number) => {
    tap();
    setCustomMode(false);
    setDefaultWaterMl(ml);
  };
  const selectCustom = () => {
    tap();
    setCustomMode(true);
    const n = Number(customMl);
    if (n >= CUSTOM_MIN && n <= CUSTOM_MAX) setDefaultWaterMl(n);
  };
  const onCustomChange = (txt: string) => {
    const digits = txt.replace(/[^0-9]/g, '');
    setCustomMl(digits);
    const n = Number(digits);
    if (n >= CUSTOM_MIN && n <= CUSTOM_MAX) setDefaultWaterMl(n);
  };

  const goNext = () => {
    tap();
    setStep((s) => Math.min(LAST, s + 1));
  };
  const goBack = () => {
    tap();
    setStep((s) => Math.max(0, s - 1));
  };

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {}
    );
    // Show the "we're computing your plan" screen for a personalised feel, THEN
    // persist (completeOnboarding flips `onboarded` → the app moves on to the
    // paywall). The duration comes from the message list itself, so the screen
    // never cuts off mid-sequence.
    setPreparing(true);
    // 7,6 secondes d'attente juste avant le paywall : suspect n°1 des abandons.
    // Comparer ce compteur à `onboarding_completed` donne le taux de survie.
    track(EV.onboardingPreparing, { duration_ms: PREP_TOTAL_MS });
    await new Promise((r) => setTimeout(r, PREP_TOTAL_MS));
    const water =
      customMode && Number(customMl) >= CUSTOM_MIN
        ? clampMl(Number(customMl))
        : defaultWaterMl;
    await completeOnboarding(
      {
        sex,
        weightKg,
        awakeHours,
        sleepStartHour,
        sleepEndHour,
        ambientTempC: envOn ? ambientTempC : null,
        relativeHumidityPct: envOn ? relativeHumidityPct : null,
        altitudeM,
        initialLevelPct: FEELING_LEVEL_PCT[feeling],
      },
      { defaultWaterMl: water }
    );
    track(EV.onboardingCompleted);
  };

  if (preparing) return <PreparingView need={need} />;

  return (
    <SafeAreaView style={styles.root}>
      {/* Progress */}
      <View style={styles.progressRow}>
        {STEPS.map((st, i) => (
          <View
            key={st.key}
            style={[
              styles.dot,
              i === step && styles.dotActive,
              i < step && styles.dotDone,
            ]}
          />
        ))}
      </View>

      <View style={styles.headerRow}>
        <Text style={styles.stepKicker}>
          {tr('onb.kicker', { n: step + 1, total: STEPS.length })}
        </Text>
        <Text style={styles.stepTitle}>{tr(STEPS[step].title)}</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/* Le tout premier écran de l'app. Aucun texte n'y est indispensable
            à la compréhension : les drapeaux suffisent à quelqu'un qui ne lit
            pas encore la langue affichée. */}
        {step === 0 && (
          <View style={styles.welcome}>
            <Text style={styles.brand}>HYDRA</Text>
            <LanguagePicker />
            <Text style={styles.paragraphDim}>{tr('onb.language.help')}</Text>
          </View>
        )}

        {step === 1 && (
          <View style={styles.welcome}>
            <Text style={styles.brand}>HYDRA</Text>
            <Text style={styles.tagline}>{tr('onb.welcome.tagline')}</Text>
            <Text style={styles.paragraph}>{tr('onb.welcome.body')}</Text>
            <Text style={styles.paragraphDim}>{tr('onb.welcome.duration')}</Text>
            {onHaveAccount ? (
              <Pressable
                onPress={() => {
                  tap();
                  onHaveAccount();
                }}
                hitSlop={8}
                style={styles.haveAccountWrap}
              >
                <Text style={styles.haveAccount}>
                  {tr('onb.welcome.haveAccount')}
                </Text>
              </Pressable>
            ) : onSignOut ? (
              <View style={styles.haveAccountWrap}>
                <Text style={styles.signedInNote}>
                  {tr('onb.welcome.signedInNote')}
                </Text>
                <Pressable
                  onPress={() => {
                    tap();
                    onSignOut();
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.haveAccount}>
                    {tr('onb.welcome.otherAccount')}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}

        {step === 2 && (
          <>
            <Text style={styles.help}>{tr('onb.you.help')}</Text>
            <Field label={tr('onb.you.sex')}>
              <View style={styles.pill}>
                {(['male', 'female'] as const).map((s) => (
                  <Pressable
                    key={s}
                    style={[styles.pillOpt, sex === s && styles.pillOptOn]}
                    onPress={() => {
                      tap();
                      setSex(s);
                    }}
                  >
                    <Text
                      style={[styles.pillTxt, sex === s && styles.pillTxtOn]}
                    >
                      {tr(s === 'male' ? 'common.male' : 'common.female')}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Field>
            <Field label={tr('onb.you.weight')}>
              <Stepper
                value={weightKg}
                min={30}
                max={200}
                step={1}
                unit="kg"
                onChange={setWeightKg}
              />
            </Field>
            <Text style={styles.needPreview}>
              {tr('onb.you.needPreview', { ml: need })}
            </Text>
          </>
        )}

        {step === 3 && (
          <>
            <Text style={styles.help}>{tr('onb.rhythm.help')}</Text>
            <Field label={tr('onb.rhythm.bedtime')}>
              <Stepper
                value={sleepStartHour}
                min={0}
                max={23}
                wrap
                format={hourFmt}
                onChange={setSleepStartHour}
              />
            </Field>
            <Field label={tr('onb.rhythm.wakeup')}>
              <Stepper
                value={sleepEndHour}
                min={0}
                max={23}
                wrap
                format={hourFmt}
                onChange={setSleepEndHour}
              />
            </Field>
            <Text style={styles.needPreview}>
              {tr('onb.rhythm.preview', { awake: awakeHours, sleep: sleepHours })}
            </Text>
          </>
        )}

        {step === 4 && (
          <>
            <Text style={styles.help}>{tr('onb.env.help')}</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{tr('onb.env.switch')}</Text>
              <Switch
                value={envOn}
                onValueChange={(v) => {
                  tap();
                  setEnvOn(v);
                }}
                trackColor={{ true: C.segmentFull, false: C.segmentEmpty }}
                thumbColor={C.text}
              />
            </View>
            {envOn && (
              <>
                <Field label={tr('onb.env.temp')}>
                  <Stepper
                    value={ambientTempC}
                    min={-20}
                    max={50}
                    unit="°C"
                    onChange={setAmbientTempC}
                  />
                </Field>
                <Field label={tr('onb.env.humidity')}>
                  <Stepper
                    value={relativeHumidityPct}
                    min={0}
                    max={100}
                    step={5}
                    unit="%"
                    onChange={setRelativeHumidityPct}
                  />
                </Field>
                <Field label={tr('onb.env.altitude')}>
                  <Stepper
                    value={altitudeM}
                    min={0}
                    max={8000}
                    step={100}
                    unit="m"
                    onChange={setAltitudeM}
                  />
                </Field>
              </>
            )}
          </>
        )}

        {step === 5 && (
          <>
            <Text style={styles.help}>{tr('onb.water.help')}</Text>
            <View style={styles.containerGrid}>
              {WATER_CONTAINERS.map((c) => {
                const on = !customMode && defaultWaterMl === c.ml;
                return (
                  <Pressable
                    key={c.ml}
                    style={[styles.container, on && styles.containerOn]}
                    onPress={() => selectPreset(c.ml)}
                  >
                    <View style={styles.containerValueRow}>
                      <Text
                        style={[styles.containerMl, on && styles.containerTxtOn]}
                      >
                        {c.ml}
                      </Text>
                      <Text
                        style={[
                          styles.containerUnit,
                          on && styles.containerTxtOn,
                        ]}
                      >
                        mL
                      </Text>
                    </View>
                    <Text
                      style={[styles.containerLabel, on && styles.containerTxtOn]}
                    >
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                style={[styles.container, customMode && styles.containerOn]}
                onPress={selectCustom}
              >
                <View style={styles.containerValueRow}>
                  <Text
                    style={[
                      styles.containerMl,
                      customMode && styles.containerTxtOn,
                    ]}
                  >
                    {customMode && customMl ? customMl : '···'}
                  </Text>
                  <Text
                    style={[
                      styles.containerUnit,
                      customMode && styles.containerTxtOn,
                    ]}
                  >
                    mL
                  </Text>
                </View>
                <Text
                  style={[
                    styles.containerLabel,
                    customMode && styles.containerTxtOn,
                  ]}
                >
                  {tr('common.custom')}
                </Text>
              </Pressable>
            </View>

            {customMode && (
              <View style={styles.customWrap}>
                <Text style={styles.fieldLabel}>{tr('onb.water.customLabel')}</Text>
                <View style={styles.customRow}>
                  <TextInput
                    style={styles.customInput}
                    keyboardType="numeric"
                    value={customMl}
                    onChangeText={onCustomChange}
                    placeholder={tr('onb.water.placeholder')}
                    placeholderTextColor={C.textDim}
                    maxLength={4}
                    autoFocus
                  />
                  <Text style={styles.customUnit}>mL</Text>
                </View>
                <Text style={styles.customHint}>
                  {tr('onb.water.range', { min: CUSTOM_MIN, max: CUSTOM_MAX })}
                </Text>
              </View>
            )}
          </>
        )}

        {step === 6 && (
          <>
            <Text style={styles.help}>{tr('onb.state.help')}</Text>
            <View style={styles.feelingList}>
              {FEELING_OPTIONS.map((opt) => {
                const on = feeling === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    style={[styles.feelingCard, on && styles.feelingCardOn]}
                    onPress={() => {
                      tap();
                      setFeeling(opt.key);
                    }}
                  >
                    <View style={styles.feelingTop}>
                      <Text
                        style={[styles.feelingLabel, on && styles.feelingTxtOn]}
                      >
                        {tr(opt.label)}
                      </Text>
                      <Text
                        style={[styles.feelingPct, on && styles.feelingTxtOn]}
                      >
                        {opt.pct} %
                      </Text>
                    </View>
                    <Text
                      style={[styles.feelingHint, on && styles.feelingHintOn]}
                    >
                      {tr(opt.hint)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {step === 7 && (
          <>
            <Text style={styles.help}>{tr('onb.recap.help')}</Text>
            <View style={styles.recap}>
              <RecapRow
                label={tr('onb.recap.sex')}
                value={tr(sex === 'male' ? 'onb.recap.male' : 'onb.recap.female')}
              />
              <RecapRow label={tr('onb.recap.weight')} value={`${weightKg} kg`} />
              <RecapRow label={tr('onb.recap.need')} value={`${need} mL`} />
              <RecapRow
                label={tr('onb.recap.sleep')}
                value={`${sleepStartHour}h → ${sleepEndHour}h (${sleepHours}h)`}
              />
              <RecapRow label={tr('onb.recap.awake')} value={`${awakeHours} h`} />
              <RecapRow
                label={tr('onb.recap.environment')}
                value={
                  envOn
                    ? `${ambientTempC}°C · ${relativeHumidityPct}% · ${altitudeM} m`
                    : tr('onb.recap.defaults')
                }
              />
              <RecapRow
                label={tr('onb.recap.container')}
                value={`${defaultWaterMl} mL`}
              />
              <RecapRow
                label={tr('onb.recap.startState')}
                value={`${feelingLabel} · ${FEELING_LEVEL_PCT[feeling]} %`}
              />
            </View>
          </>
        )}
      </ScrollView>

      {/* Nav */}
      <View style={styles.nav}>
        {step > 0 ? (
          <Pressable style={styles.backBtn} onPress={goBack}>
            <Text style={styles.backTxt}>{tr('common.back')}</Text>
          </Pressable>
        ) : (
          <View style={styles.backSpacer} />
        )}
        <Pressable
          style={styles.primaryBtn}
          onPress={step === LAST ? finish : goNext}
          disabled={busy}
        >
          <Text style={styles.primaryTxt}>
            {tr(
              step === 1
                ? 'common.start'
                : step === LAST
                ? 'common.letsGo'
                : 'common.next'
            )}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// Personalised "we're preparing your plan" transition shown between the last
// onboarding step and the paywall. Cycles a few reassuring lines while the
// answers are saved, so the paywall feels earned rather than abrupt.
const PREP_MSGS: readonly StringKey[] = [
  'onb.prep.1',
  'onb.prep.2',
  'onb.prep.3',
  'onb.prep.4',
  'onb.prep.5',
  'onb.prep.6',
  'onb.prep.7',
  'onb.prep.8',
  'onb.prep.9',
];

const PREP_STEP_MS = 850;
// Derived, not hand-written: the screen used to hold for a hard-coded 2 700 ms
// that had to be kept in step with the message list by hand. Now adding or
// removing a line adjusts the duration on its own.
export const PREP_TOTAL_MS = PREP_MSGS.length * PREP_STEP_MS;

function PreparingView({ need }: { need: number }) {
  const tr = useT();
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setIdx((i) => Math.min(PREP_MSGS.length - 1, i + 1)),
      PREP_STEP_MS
    );
    return () => clearInterval(id);
  }, []);
  return (
    <SafeAreaView style={styles.prepRoot}>
      <View style={styles.prepInner}>
        <Text style={styles.prepBrand}>HYDRA</Text>
        <ActivityIndicator
          size="large"
          color={C.segmentFull}
          style={{ marginVertical: 28 }}
        />
        <Text style={styles.prepMsg}>{tr(PREP_MSGS[idx])}</Text>
        <Text style={styles.prepNeed}>{tr('onb.prep.goal', { ml: need })}</Text>
      </View>
    </SafeAreaView>
  );
}

function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.recapRow}>
      <Text style={styles.recapLabel}>{label}</Text>
      <Text style={styles.recapValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  prepRoot: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prepInner: { paddingHorizontal: 40, alignItems: 'center' },
  prepBrand: {
    color: C.segmentFull,
    fontFamily: FONTS.display,
    fontSize: 44,
    letterSpacing: 10,
  },
  prepMsg: {
    color: C.text,
    fontFamily: FONTS.mono,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    minHeight: 63,
  },
  prepNeed: {
    color: C.segmentFull,
    fontFamily: FONTS.label,
    fontSize: 12,
    letterSpacing: 1.5,
    marginTop: 20,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  dot: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: C.segmentEmpty,
  },
  dotActive: { backgroundColor: C.segmentFull },
  dotDone: { backgroundColor: C.segmentFullDeep },
  headerRow: { paddingHorizontal: 24, paddingTop: 20 },
  stepKicker: {
    color: C.textDim,
    fontFamily: FONTS.label,
    fontSize: 11,
    letterSpacing: 2,
  },
  stepTitle: {
    color: C.text,
    fontFamily: FONTS.display,
    fontSize: 30,
    letterSpacing: 3,
    marginTop: 4,
  },
  body: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, gap: 8 },

  welcome: { gap: 16, paddingTop: 12 },
  brand: {
    color: C.segmentFull,
    fontFamily: FONTS.display,
    fontSize: 52,
    letterSpacing: 10,
  },
  tagline: {
    color: C.text,
    fontFamily: FONTS.label,
    fontSize: 16,
    letterSpacing: 1,
  },
  paragraph: {
    color: C.text,
    fontFamily: FONTS.mono,
    fontSize: 13,
    lineHeight: 20,
  },
  paragraphDim: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 12,
    lineHeight: 18,
  },
  haveAccountWrap: { marginTop: 28, alignItems: 'center', gap: 10 },
  signedInNote: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
  },
  haveAccount: {
    color: C.segmentFull,
    fontFamily: FONTS.label,
    fontSize: 12,
    letterSpacing: 1,
    textDecorationLine: 'underline',
  },

  help: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  field: { marginBottom: 20 },
  fieldLabel: {
    color: C.textDim,
    fontFamily: FONTS.label,
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: 12,
  },

  pill: {
    flexDirection: 'row',
    backgroundColor: C.bgSoft,
    borderRadius: RADIUS.md,
    padding: 4,
    gap: 4,
  },
  pillOpt: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  pillOptOn: { backgroundColor: C.segmentFull },
  pillTxt: {
    color: C.text,
    fontFamily: FONTS.display,
    fontSize: 14,
    letterSpacing: 2,
  },
  pillTxtOn: { color: C.bg },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.bgSoft,
    borderRadius: RADIUS.md,
    padding: 8,
  },
  stepBtn: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.sm,
    backgroundColor: C.segmentEmpty,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnOff: { opacity: 0.35 },
  stepBtnTxt: {
    color: C.text,
    fontFamily: FONTS.monoBold,
    fontSize: 28,
    lineHeight: 30,
  },
  stepValueWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  stepValue: {
    color: C.text,
    fontFamily: FONTS.monoBold,
    fontSize: 34,
    letterSpacing: 1,
  },
  stepUnit: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 16,
  },
  needPreview: {
    color: C.segmentFull,
    fontFamily: FONTS.label,
    fontSize: 12,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginTop: 4,
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.bgSoft,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  switchLabel: {
    color: C.text,
    fontFamily: FONTS.label,
    fontSize: 12,
    letterSpacing: 1.5,
    flex: 1,
  },

  containerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  container: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: C.bgSoft,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingVertical: 22,
    alignItems: 'center',
    gap: 4,
  },
  containerOn: { borderColor: C.segmentFull, backgroundColor: '#0d1a12' },

  feelingList: { gap: 10, marginTop: 4 },
  feelingCard: {
    borderWidth: 1,
    borderColor: C.segmentEmpty,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: C.bgSoft,
  },
  feelingCardOn: {
    borderColor: C.segmentFull,
    backgroundColor: '#0d1a12',
  },
  feelingTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  feelingLabel: {
    color: C.text,
    fontFamily: FONTS.label,
    fontSize: 14,
    letterSpacing: 2,
  },
  feelingPct: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 14,
  },
  feelingTxtOn: { color: C.segmentFull },
  feelingHint: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 12,
    lineHeight: 18,
  },
  feelingHintOn: { color: C.text },
  containerValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  containerMl: {
    color: C.text,
    fontFamily: FONTS.monoBold,
    fontSize: 26,
  },
  containerUnit: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 13,
  },
  containerLabel: {
    color: C.textDim,
    fontFamily: FONTS.label,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  containerTxtOn: { color: C.segmentFull },

  customWrap: { marginTop: 16 },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgSoft,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: C.segmentFull,
    paddingHorizontal: 16,
  },
  customInput: {
    flex: 1,
    color: C.text,
    fontFamily: FONTS.monoBold,
    fontSize: 26,
    paddingVertical: 16,
  },
  customUnit: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 16,
  },
  customHint: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 11,
    marginTop: 8,
  },

  recap: {
    backgroundColor: C.bgSoft,
    borderRadius: RADIUS.md,
    padding: 4,
  },
  recapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.segmentEmpty,
  },
  recapLabel: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 13,
  },
  recapValue: {
    color: C.text,
    fontFamily: FONTS.monoBold,
    fontSize: 13,
  },

  nav: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
  },
  backSpacer: { flex: 0 },
  backBtn: {
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: C.segmentEmpty,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTxt: {
    color: C.textDim,
    fontFamily: FONTS.display,
    fontSize: 14,
    letterSpacing: 2,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: RADIUS.lg,
    backgroundColor: C.segmentFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryTxt: {
    color: C.bg,
    fontFamily: FONTS.display,
    fontSize: 16,
    letterSpacing: 3,
  },
});
