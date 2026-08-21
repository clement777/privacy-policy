import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SportIntensity } from '../engine/hydrationEngine';
import { C, FONTS, RADIUS } from '../theme/colors';
import { useT } from '../i18n';

const DURATIONS = [15, 30, 45, 60] as const;

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (durationMin: number, intensity: SportIntensity) => void;
}

export function SportLogModal({ visible, onClose, onConfirm }: Props) {
  const tr = useT();
  const [intensity, setIntensity] = useState<SportIntensity>('moderate');
  const [durationMin, setDurationMin] = useState<number>(30);

  const submit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onConfirm(durationMin, intensity);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{tr('sport.title')}</Text>

          <Text style={styles.label}>{tr('sport.intensity')}</Text>
          <View style={styles.row}>
            {(['moderate', 'intense'] as const).map((k) => (
              <Pressable
                key={k}
                style={[styles.pill, intensity === k && styles.pillOn]}
                onPress={() => setIntensity(k)}
              >
                <Text style={[styles.pillTxt, intensity === k && styles.pillTxtOn]}>
                  {tr(k === 'moderate' ? 'sport.moderate' : 'sport.intense')}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>{tr('sport.duration')}</Text>
          <View style={styles.row}>
            {DURATIONS.map((d) => (
              <Pressable
                key={d}
                style={[styles.pill, durationMin === d && styles.pillOn]}
                onPress={() => setDurationMin(d)}
              >
                <Text style={[styles.pillTxt, durationMin === d && styles.pillTxtOn]}>
                  {d} min
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.hint}>{tr('sport.hint')}</Text>

          <Pressable style={styles.confirm} onPress={submit}>
            <Text style={styles.confirmTxt}>{tr('sport.confirm')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0a0d12',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#1a1e26',
    padding: 22,
    paddingBottom: 32,
  },
  title: {
    color: C.text,
    fontFamily: FONTS.display,
    fontSize: 22,
    letterSpacing: 4,
    marginBottom: 18,
  },
  label: {
    color: C.textDim,
    fontFamily: FONTS.label,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 8,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: C.segmentEmpty,
    backgroundColor: C.bgSoft,
  },
  pillOn: { borderColor: C.text, backgroundColor: C.text },
  pillTxt: {
    color: C.text,
    fontFamily: FONTS.display,
    fontSize: 12,
    letterSpacing: 2,
  },
  pillTxtOn: { color: C.bg },
  hint: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 16,
  },
  confirm: {
    marginTop: 24,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: C.text,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmTxt: {
    color: C.text,
    fontFamily: FONTS.display,
    letterSpacing: 2,
    fontSize: 15,
    textAlign: 'center',
  },
});
