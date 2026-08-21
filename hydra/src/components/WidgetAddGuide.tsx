import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { C, FONTS, RADIUS } from '../theme/colors';
import { HydrationState } from '../engine/hydrationEngine';
import { LockWidget, SmallWidget } from './WidgetMocks';
import { StringKey, useT } from '../i18n';

export type GuideTarget = 'lock' | 'home';

const STEPS: Record<GuideTarget, { title: StringKey; steps: StringKey[] }> = {
  lock: {
    title: 'guide.lock.title',
    steps: [
      'guide.lock.1',
      'guide.lock.2',
      'guide.lock.3',
      'guide.lock.4',
      'guide.lock.5',
    ],
  },
  home: {
    title: 'guide.home.title',
    steps: [
      'guide.home.1',
      'guide.home.2',
      'guide.home.3',
      'guide.home.4',
      'guide.home.5',
    ],
  },
};
export function WidgetAddGuide({
  visible,
  target,
  state,
  onClose,
}: {
  visible: boolean;
  target: GuideTarget;
  state: HydrationState;
  onClose: () => void;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((r) => mounted && setReduceMotion(r))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (r) => mounted && setReduceMotion(r)
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible || reduceMotion) {
      pulse.stopAnimation();
      pulse.setValue(reduceMotion ? 1 : 0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, reduceMotion, pulse]);

  const tr = useT();
  const conf = STEPS[target];
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 28 }}>
            <Text style={styles.title}>{tr(conf.title)}</Text>

            <View style={styles.stage}>
              {target === 'lock' ? (
                <>
                  <Text style={styles.clock}>9:41</Text>
                  <LockWidget state={state} />
                </>
              ) : (
                <SmallWidget state={state} />
              )}
              <Animated.View
                style={[styles.plusBadge, { transform: [{ scale }], opacity }]}
              >
                <Text style={styles.plusTxt}>+</Text>
              </Animated.View>
            </View>

            <View style={styles.steps}>
              {conf.steps.map((key, i) => (
                <View key={key} style={styles.stepRow}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumTxt}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepTxt}>{tr(key)}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.note}>{tr('guide.note')}</Text>

            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeTxt}>{tr('common.gotItLong')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '92%',
    backgroundColor: '#0a0d12',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: '#1a1e26',
  },
  title: {
    color: C.text,
    fontFamily: FONTS.display,
    fontSize: 18,
    letterSpacing: 2,
    marginBottom: 18,
  },
  stage: {
    borderRadius: 24,
    paddingVertical: 24,
    alignItems: 'center',
    backgroundColor: '#050709',
    borderWidth: 1,
    borderColor: '#14171d',
    marginBottom: 20,
  },
  clock: {
    color: '#f4f6f8',
    fontFamily: FONTS.display,
    fontSize: 40,
    marginBottom: 12,
  },
  plusBadge: {
    marginTop: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(62,224,122,0.15)',
    borderWidth: 1.5,
    borderColor: C.segmentFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusTxt: {
    color: C.segmentFull,
    fontSize: 26,
    lineHeight: 30,
    fontFamily: FONTS.display,
  },
  steps: { gap: 14 },
  stepRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.bgSoft,
    borderWidth: 1,
    borderColor: C.segmentFull,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumTxt: {
    color: C.segmentFull,
    fontFamily: FONTS.monoBold,
    fontSize: 12,
  },
  stepTxt: {
    flex: 1,
    color: C.text,
    fontFamily: FONTS.mono,
    fontSize: 13,
    lineHeight: 20,
  },
  note: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 20,
  },
  closeBtn: {
    marginTop: 22,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: C.segmentFull,
    paddingVertical: 15,
    alignItems: 'center',
  },
  closeTxt: {
    color: C.segmentFull,
    fontFamily: FONTS.display,
    letterSpacing: 3,
    fontSize: 14,
  },
});
