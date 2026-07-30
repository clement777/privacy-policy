import React, { useEffect, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  Alert,
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
import { useAuth } from '../store/useAuth';
import {
  awakeHoursFromSleep,
  computeState,
  dailyNeedMl,
  HydrationState,
  Zone,
} from '../engine/hydrationEngine';
import { useHydration } from '../store/useHydration';
import { ensurePermissions } from '../notifications/scheduler';
import { LockWidget, MediumWidget, SmallWidget } from '../components/WidgetMocks';
import { WidgetAddGuide, GuideTarget } from '../components/WidgetAddGuide';
import { SourcesSheet } from '../components/SourcesSheet';
import { WATER_CONTAINERS, WidgetFormat } from '../store/widgetSettings';

type PreviewMode = 'live' | Zone;

const STATE_CHIPS: { key: PreviewMode; label: string }[] = [
  { key: 'live', label: 'DIRECT' },
  { key: 'green', label: 'HYDRATÉ' },
  { key: 'amber', label: 'TU SÈCHES' },
  { key: 'red', label: 'CRITIQUE' },
  { key: 'poison', label: 'EMPOISONNÉ' },
];

const FORMAT_CHIPS: { key: WidgetFormat; label: string }[] = [
  { key: 'lock', label: 'VERROUILLAGE' },
  { key: 'small', label: 'CARRÉ 2×2' },
  { key: 'medium', label: 'BANDEAU 4×2' },
];

const NEED = 2240;
const RATE_PER_H = NEED / 16;

function previewState(zone: Zone): HydrationState {
  const pct = zone === 'green' ? 78 : zone === 'amber' ? 42 : zone === 'red' ? 18 : 66;
  const poisoned = zone === 'poison';
  const poisonMult = poisoned ? 1.6 : 1;
  const levelMl = (pct / 100) * NEED;
  const redThresh = 0.25 * NEED;
  const secsToRed =
    levelMl <= redThresh
      ? 0
      : ((levelMl - redThresh) / (RATE_PER_H * poisonMult)) * 3600;
  return {
    levelMl,
    dailyNeedMl: NEED,
    levelPct: pct,
    zone,
    poisoned,
    poisonUntil: poisoned ? Date.now() + 3 * 3600_000 : null,
    poisonMult,
    ambleAt: null,
    redAt: Date.now() + secsToRed * 1000,
    absorbedLastHourMl: 0,
    absorbCapMl: 1000,
    saturated: false,
  };
}

function Chip({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{label}</Text>
    </Pressable>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

export function WidgetsScreen() {
  const {
    events,
    profile,
    widget,
    updateProfile,
    updateWidget,
    refreshWidget,
    restartOnboarding,
  } = useHydration();

  const { user, signOut, deleteAccount } = useAuth();
  const [mode, setMode] = useState<PreviewMode>('live');
  const [guide, setGuide] = useState<GuideTarget | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  // Traité comme activé tant qu'il n'est pas explicitement désactivé — même
  // repli que scheduler.ts pour rester compatible avec les profils existants.
  const glassRemindersOn = widget.glassRemindersEnabled !== false;

  // ── Contenant eau : préréglages + volume personnalisé ──────────────────────
  const WATER_MIN = 50;
  const WATER_MAX = 2000;
  const isWaterPreset = WATER_CONTAINERS.some((c) => c.ml === widget.defaultWaterMl);
  const [customWaterMode, setCustomWaterMode] = useState(!isWaterPreset);
  const [customWaterMl, setCustomWaterMl] = useState(String(widget.defaultWaterMl));

  const selectWaterPreset = (ml: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCustomWaterMode(false);
    updateWidget({ defaultWaterMl: ml });
  };
  const selectCustomWater = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCustomWaterMode(true);
    const n = Number(customWaterMl);
    if (n >= WATER_MIN && n <= WATER_MAX) updateWidget({ defaultWaterMl: n });
  };
  const onCustomWaterChange = (txt: string) => {
    const digits = txt.replace(/[^0-9]/g, '');
    setCustomWaterMl(digits);
    const n = Number(digits);
    if (n >= WATER_MIN && n <= WATER_MAX) updateWidget({ defaultWaterMl: n });
  };

  const confirmRestartOnboarding = () => {
    Alert.alert(
      'Refaire le questionnaire',
      'Tu vas repasser par la configuration guidée (poids, sexe, sommeil, environnement, contenant). Tes données actuelles restent enregistrées.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Continuer', onPress: () => restartOnboarding() },
      ]
    );
  };

  const confirmDelete = () => {
    Alert.alert(
      'Supprimer le compte',
      'Toutes tes données (profil, historique) seront définitivement effacées. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const r = await deleteAccount();
            if (!r.ok) Alert.alert('Erreur', r.message);
          },
        },
      ]
    );
  };
  const [toast, setToast] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const state = useMemo<HydrationState>(
    () =>
      mode === 'live'
        ? computeState(events, nowMs, profile)
        : previewState(mode),
    [mode, events, profile, nowMs]
  );

  const need = dailyNeedMl(profile);

  const doRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await refreshWidget();
    setToast('Widget rafraîchi.');
    setTimeout(() => setToast(null), 2000);
  };

  const num = (key: keyof typeof profile, min: number, max: number, step = 1) => (
    <TextInput
      style={styles.input}
      keyboardType="numeric"
      defaultValue={String((profile[key] as number | null) ?? '')}
      onEndEditing={(e) => {
        const parsed = Number(e.nativeEvent.text.replace(',', '.'));
        if (isNaN(parsed)) return;
        const clamped = Math.max(min, Math.min(max, parsed));
        updateProfile({ [key]: Math.round(clamped / step) * step } as any);
      }}
    />
  );

  // Sleep drives awakeHours, so editing either bound recomputes it in one patch.
  const sleepInput = (key: 'sleepStartHour' | 'sleepEndHour') => (
    <TextInput
      style={styles.input}
      keyboardType="numeric"
      defaultValue={String(profile[key])}
      onEndEditing={(e) => {
        const parsed = Number(e.nativeEvent.text.replace(',', '.'));
        if (isNaN(parsed)) return;
        const v = Math.max(0, Math.min(23, Math.round(parsed)));
        const start = key === 'sleepStartHour' ? v : profile.sleepStartHour;
        const end = key === 'sleepEndHour' ? v : profile.sleepEndHour;
        updateProfile({ [key]: v, awakeHours: awakeHoursFromSleep(start, end) });
      }}
    />
  );

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
        <Text style={styles.title}>WIDGETS</Text>
        <Text style={styles.subtitle}>
          Le produit, c'est le widget. Cet écran est son poste de pilotage :
          aperçu, ajout, et les réglages qui l'alimentent.
        </Text>

        {/* ————— APERÇU ————— */}
        <Text style={styles.section}>APERÇU</Text>
        <View style={styles.chipRow}>
          {FORMAT_CHIPS.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              on={widget.preferredFormat === c.key}
              onPress={() => updateWidget({ preferredFormat: c.key })}
            />
          ))}
        </View>
        <View style={styles.chipRow}>
          {STATE_CHIPS.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              on={mode === c.key}
              onPress={() => setMode(c.key)}
            />
          ))}
        </View>

        <View style={styles.stage}>
          {widget.preferredFormat === 'lock' && (
            <>
              <Text style={styles.clock}>9:41</Text>
              <LockWidget state={state} waterMl={widget.defaultWaterMl} />
            </>
          )}
          {widget.preferredFormat === 'small' && (
            <SmallWidget state={state} waterMl={widget.defaultWaterMl} />
          )}
          {widget.preferredFormat === 'medium' && (
            <MediumWidget
              state={state}
              waterMl={widget.defaultWaterMl}
              showAlcohol={widget.showAlcoholOnMedium}
            />
          )}
        </View>

        {/* ————— AJOUT ————— */}
        <Text style={styles.section}>AJOUTER LE WIDGET</Text>
        <Pressable style={styles.action} onPress={() => setGuide('lock')}>
          <Text style={styles.actionTxt}>AJOUTER À L'ÉCRAN VERROUILLÉ</Text>
          <Text style={styles.actionArrow}>›</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={() => setGuide('home')}>
          <Text style={styles.actionTxt}>AJOUTER À L'ÉCRAN D'ACCUEIL</Text>
          <Text style={styles.actionArrow}>›</Text>
        </Pressable>
        <Pressable
          style={[styles.action, styles.actionPrimary]}
          onPress={doRefresh}
        >
          <Text style={[styles.actionTxt, { color: C.segmentFull }]}>
            RAFRAÎCHIR LE WIDGET
          </Text>
          <Text style={[styles.actionArrow, { color: C.segmentFull }]}>⟳</Text>
        </Pressable>
        {toast ? <Text style={styles.toast}>{toast}</Text> : null}

        {/* ————— RÉGLAGES WIDGET ————— */}
        <Text style={styles.section}>RÉGLAGES WIDGET</Text>
        <Row label="BOUTONS ALCOOL (BANDEAU)">
          <View style={{ alignItems: 'flex-end' }}>
            <Switch
              value={widget.showAlcoholOnMedium}
              onValueChange={(v) => updateWidget({ showAlcoholOnMedium: v })}
            />
          </View>
        </Row>
        <Text style={styles.miniLabel}>CONTENANT EAU PAR DÉFAUT</Text>
        <View style={styles.chipRow}>
          {WATER_CONTAINERS.map((c) => (
            <Chip
              key={c.ml}
              label={`${c.label} ${c.ml} mL`}
              on={!customWaterMode && widget.defaultWaterMl === c.ml}
              onPress={() => selectWaterPreset(c.ml)}
            />
          ))}
          <Chip
            label={
              customWaterMode && customWaterMl
                ? `PERSO ${customWaterMl} mL`
                : 'PERSONNALISÉ'
            }
            on={customWaterMode}
            onPress={selectCustomWater}
          />
        </View>
        {customWaterMode && (
          <View style={styles.customRow}>
            <TextInput
              style={styles.customInput}
              keyboardType="numeric"
              value={customWaterMl}
              onChangeText={onCustomWaterChange}
              placeholder="ex. 400"
              placeholderTextColor={C.textDim}
              maxLength={4}
            />
            <Text style={styles.customUnit}>mL</Text>
          </View>
        )}

        {/* ————— PROFIL ————— */}
        <Text style={styles.section}>PROFIL (ALIMENTE LE WIDGET)</Text>
        <Row label="POIDS (kg)">{num('weightKg', 30, 200)}</Row>
        <Row label="SEXE">
          <View style={styles.pill}>
            {(['male', 'female'] as const).map((s) => (
              <Pressable
                key={s}
                style={[styles.pillOpt, profile.sex === s && styles.pillOptOn]}
                onPress={() => updateProfile({ sex: s })}
              >
                <Text style={[styles.pillTxt, profile.sex === s && { color: C.bg }]}>
                  {s === 'male' ? 'H' : 'F'}
                </Text>
              </Pressable>
            ))}
          </View>
        </Row>
        <Row label="SOMMEIL DÉBUT">{sleepInput('sleepStartHour')}</Row>
        <Row label="SOMMEIL FIN">{sleepInput('sleepEndHour')}</Row>
        <Row label="HEURES ÉVEIL (AUTO)">
          <Text style={styles.readonly}>{profile.awakeHours} h</Text>
        </Row>
        <Row label="TEMP AMBIANTE °C">{num('ambientTempC', -20, 50)}</Row>
        <Row label="HUMIDITÉ %">{num('relativeHumidityPct', 0, 100)}</Row>
        <Row label="ALTITUDE (m)">{num('altitudeM', 0, 8000, 100)}</Row>
        <Row label="OBJECTIF">
          <Text style={styles.readonly}>
            {Math.round(need)} mL / jour ({profile.weightKg} × 32)
          </Text>
        </Row>
        <Pressable style={styles.action} onPress={confirmRestartOnboarding}>
          <Text style={styles.actionTxt}>REFAIRE LE QUESTIONNAIRE</Text>
          <Text style={styles.actionArrow}>›</Text>
        </Pressable>

        {/* ————— NOTIFS ————— */}
        <Text style={styles.section}>NOTIFICATIONS</Text>
        <Row label="RAPPELS PAR VERRE">
          <View style={{ alignItems: 'flex-end' }}>
            <Switch
              value={glassRemindersOn}
              onValueChange={async (v) => {
                if (v) await ensurePermissions();
                await updateWidget({ glassRemindersEnabled: v });
              }}
            />
          </View>
        </Row>
        <Text style={styles.miniLabel}>
          Un rappel programmé pour chaque verre encore nécessaire aujourd'hui,
          étalé jusqu'à ton coucher ({profile.sleepStartHour} h). Les alertes
          zone ambre/rouge restent actives dans tous les cas.
        </Text>

        {/* ————— COMPTE ————— */}
        <Text style={styles.section}>COMPTE</Text>
        <Row label="CONNECTÉ">
          <Text style={styles.readonly} numberOfLines={1}>
            {user?.email ?? 'Apple ID'}
          </Text>
        </Row>
        <Pressable style={styles.acctBtn} onPress={() => signOut()}>
          <Text style={styles.acctBtnTxt}>SE DÉCONNECTER</Text>
        </Pressable>
        <Pressable style={styles.acctDanger} onPress={confirmDelete}>
          <Text style={styles.acctDangerTxt}>SUPPRIMER LE COMPTE</Text>
        </Pressable>

        {/* ————— SCIENCE ————— */}
        <Text style={styles.section}>SCIENCE</Text>
        <Pressable style={styles.action} onPress={() => setSourcesOpen(true)}>
          <Text style={styles.actionTxt}>SOURCES SCIENTIFIQUES</Text>
          <Text style={styles.actionArrow}>›</Text>
        </Pressable>

        <Text style={styles.disclaimer}>
          App grand public à but ludique et informatif. Ce n'est pas un
          dispositif médical. Les coefficients sont des moyennes de population.
          Consulte un professionnel de santé pour tout besoin d'hydratation
          spécifique.
        </Text>
      </ScrollView>

      <WidgetAddGuide
        visible={guide !== null}
        target={guide ?? 'lock'}
        state={state}
        onClose={() => setGuide(null)}
      />
      <SourcesSheet
        visible={sourcesOpen}
        onClose={() => setSourcesOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  title: {
    color: C.text,
    fontFamily: FONTS.display,
    fontSize: 26,
    letterSpacing: 4,
  },
  subtitle: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  section: {
    color: C.textDim,
    fontFamily: FONTS.label,
    fontSize: 11,
    letterSpacing: 3,
    marginTop: 28,
    marginBottom: 12,
  },
  miniLabel: {
    color: C.textDim,
    fontFamily: FONTS.label,
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 4,
    marginBottom: 10,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: C.segmentEmpty,
    backgroundColor: C.bgSoft,
  },
  chipOn: { borderColor: C.segmentFull, backgroundColor: 'rgba(62,224,122,0.12)' },
  chipTxt: {
    color: C.textDim,
    fontFamily: FONTS.label,
    fontSize: 11,
    letterSpacing: 1,
  },
  chipTxtOn: { color: C.segmentFull },
  stage: {
    borderRadius: 24,
    paddingVertical: 26,
    marginTop: 6,
    alignItems: 'center',
    backgroundColor: '#0a0d12',
    borderWidth: 1,
    borderColor: '#14171d',
  },
  clock: {
    color: '#f4f6f8',
    fontFamily: FONTS.display,
    fontSize: 52,
    marginBottom: 16,
    letterSpacing: -1,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: RADIUS.md,
    backgroundColor: C.bgSoft,
    borderWidth: 1,
    borderColor: C.segmentEmpty,
    marginBottom: 10,
  },
  actionPrimary: { borderColor: C.segmentFull },
  actionTxt: {
    color: C.text,
    fontFamily: FONTS.display,
    letterSpacing: 2,
    fontSize: 13,
  },
  actionArrow: { color: C.textDim, fontSize: 20, fontFamily: FONTS.display },
  toast: {
    color: C.segmentFull,
    fontFamily: FONTS.label,
    fontSize: 12,
    letterSpacing: 1,
    textAlign: 'center',
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: C.bgSoft,
    borderRadius: RADIUS.md,
    gap: 12,
    marginBottom: 8,
  },
  rowLabel: {
    color: C.textDim,
    fontFamily: FONTS.label,
    letterSpacing: 2,
    minWidth: 130,
    fontSize: 11,
  },
  input: {
    color: C.text,
    fontFamily: FONTS.mono,
    textAlign: 'right',
    fontSize: 16,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bgSoft,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: C.segmentFull,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  customInput: {
    flex: 1,
    color: C.text,
    fontFamily: FONTS.monoBold,
    fontSize: 22,
    paddingVertical: 14,
  },
  customUnit: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 15,
  },
  readonly: {
    color: C.text,
    fontFamily: FONTS.mono,
    textAlign: 'right',
    fontSize: 13,
  },
  pill: { flexDirection: 'row', alignSelf: 'flex-end', gap: 6 },
  pillOpt: {
    borderWidth: 1.5,
    borderColor: C.segmentEmpty,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  pillOptOn: { backgroundColor: C.segmentFull, borderColor: C.segmentFull },
  pillTxt: {
    color: C.text,
    fontFamily: FONTS.display,
    letterSpacing: 2,
    fontSize: 12,
  },
  disclaimer: {
    marginTop: 30,
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 11,
    lineHeight: 16,
  },
  acctBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: C.segmentEmpty,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  acctBtnTxt: { color: C.text, fontFamily: FONTS.label, letterSpacing: 2, fontSize: 12 },
  acctDanger: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  acctDangerTxt: { color: C.red, fontFamily: FONTS.label, letterSpacing: 2, fontSize: 12 },
});
