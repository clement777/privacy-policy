import React, { useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import { C, FONTS, RADIUS } from '../theme/colors';
import { useT } from '../i18n';

interface Props {
  title: string;
  body: string;
  accessibilityLabel?: string;
}

export function InfoTip({ title, body, accessibilityLabel }: Props) {
  const tr = useT();
  const [open, setOpen] = useState(false);

  const show = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setOpen(true);
  };

  return (
    <>
      <Pressable
        onPress={show}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={
          accessibilityLabel ?? tr('common.details', { label: title })
        }
        style={styles.btn}
      >
        <Text style={styles.btnTxt}>i</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={styles.card}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
            <Pressable style={styles.okBtn} onPress={() => setOpen(false)}>
              <Text style={styles.okTxt}>{tr('common.gotIt')}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.textDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnTxt: {
    color: C.textDim,
    fontFamily: FONTS.monoBold,
    fontSize: 11,
    lineHeight: 12,
    marginTop: -1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: '#0a0d12',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1a1e26',
    padding: 22,
    gap: 14,
  },
  title: {
    color: C.text,
    fontFamily: FONTS.display,
    fontSize: 16,
    letterSpacing: 2,
  },
  body: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 12,
    lineHeight: 19,
  },
  okBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  okTxt: {
    color: C.segmentFull,
    fontFamily: FONTS.label,
    fontSize: 12,
    letterSpacing: 2,
  },
});
