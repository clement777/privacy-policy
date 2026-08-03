import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuth } from '../store/useAuth';
import { C, FONTS, RADIUS } from '../theme/colors';

type Mode = 'signIn' | 'signUp';

interface Props {
  // Reached at the funnel's end → default to sign-up. Opened from the paywall's
  // "Déjà un compte ?" link → 'signIn'.
  initialMode?: Mode;
  // When there's a paywall behind (user came from it), a way back to it.
  onBack?: () => void;
  // Whether creating an account is a legitimate outcome on this screen.
  //
  // It is not, when the user arrived through the "Déjà un compte ?" detour: in
  // this funnel the account is created AFTER the trial starts, so signing up
  // here produces an account with no subscription — and the router then sends
  // the user straight back to the paywall. Two of the three people who finished
  // the questionnaire on 3 Aug fell into exactly that loop, created an account,
  // and left without ever starting a trial. Someone who followed a link saying
  // "already have an account" has one; offering them sign-up is a dead end.
  allowSignUp?: boolean;
}

export function AuthScreen({
  initialMode = 'signUp',
  onBack,
  allowSignUp = true,
}: Props = {}) {
  const { appleAvailable, signInWithApple, signInWithEmail, signUpWithEmail } =
    useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submitEmail = async () => {
    setError(null);
    setInfo(null);
    if (!email.includes('@') || password.length < 6) {
      setError('Email valide + mot de passe de 6 caractères minimum.');
      return;
    }
    setBusy(true);
    const r =
      mode === 'signIn'
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password);
    setBusy(false);
    if (!r.ok) setError(r.message);
    else if (mode === 'signUp')
      setInfo('Compte créé. Vérifie ta boîte mail si une confirmation est demandée.');
  };

  const doApple = async () => {
    setError(null);
    setBusy(true);
    const r = await signInWithApple();
    setBusy(false);
    if (!r.ok) setError(r.message);
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={10} style={styles.back}>
              <Text style={styles.backTxt}>← Retour</Text>
            </Pressable>
          ) : null}

          <View style={styles.hero}>
            <Text style={styles.brand}>HYDRA</Text>
            <Text style={styles.tag}>
              {mode === 'signIn'
                ? 'Reconnecte-toi pour retrouver ta progression et ton abonnement.'
                : 'Dernière étape : crée ton compte pour sauvegarder ta progression et retrouver ta barre sur tous tes appareils.'}
            </Text>
          </View>

          {/* An explicit two-way switch, not just the footer link. App Review
              reported "no action took place" after tapping "Déjà un compte ?
              Se connecter": that link only flipped the tagline and the submit
              label, which on a large screen reads as nothing having happened.
              The selected tab makes the current mode unambiguous. */}
          {allowSignUp ? (
          <View style={styles.modes}>
            {(['signIn', 'signUp'] as const).map((m) => (
              <Pressable
                key={m}
                style={[styles.modeTab, mode === m && styles.modeTabOn]}
                onPress={() => {
                  setMode(m);
                  setError(null);
                  setInfo(null);
                }}
                disabled={busy}
              >
                <Text
                  style={[styles.modeTxt, mode === m && styles.modeTxtOn]}
                >
                  {m === 'signIn' ? 'SE CONNECTER' : 'CRÉER UN COMPTE'}
                </Text>
              </Pressable>
            ))}
          </View>
          ) : null}

          {appleAvailable ? (
            <>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={
                  AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
                }
                buttonStyle={
                  AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                }
                cornerRadius={RADIUS.md}
                style={styles.appleBtn}
                onPress={doApple}
              />
              <View style={styles.divider}>
                <View style={styles.line} />
                <Text style={styles.or}>OU</Text>
                <View style={styles.line} />
              </View>
            </>
          ) : null}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={C.textDim}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={!busy}
          />
          <TextInput
            style={styles.input}
            placeholder="Mot de passe"
            placeholderTextColor={C.textDim}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!busy}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {info ? <Text style={styles.info}>{info}</Text> : null}

          <Pressable
            style={[styles.primary, busy && { opacity: 0.6 }]}
            onPress={submitEmail}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={C.bg} />
            ) : (
              <Text style={styles.primaryTxt}>
                {mode === 'signIn' ? 'SE CONNECTER' : 'CRÉER UN COMPTE'}
              </Text>
            )}
          </Pressable>

          {/* Replaces the old footer toggle, which duplicated the switch above
              and was the element App Review found unresponsive. */}
          <Text style={styles.toggle}>
            {!allowSignUp
              ? 'Pas encore de compte ? Reviens en arrière : ton compte se crée une fois l’essai démarré.'
              : mode === 'signIn'
              ? 'Pas encore de compte ? Choisis CRÉER UN COMPTE en haut.'
              : 'Déjà un compte ? Choisis SE CONNECTER en haut.'}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 24, paddingTop: 60, gap: 14, minHeight: '100%' },
  back: { alignSelf: 'flex-start', marginBottom: 8 },
  backTxt: { color: C.textDim, fontFamily: FONTS.mono, fontSize: 13 },
  hero: { alignItems: 'center', marginBottom: 30 },
  brand: {
    color: C.segmentFull,
    fontFamily: FONTS.display,
    fontSize: 46,
    letterSpacing: 12,
  },
  tag: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  modes: {
    flexDirection: 'row',
    backgroundColor: C.bgSoft,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.segmentEmpty,
    padding: 4,
    gap: 4,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  modeTabOn: { backgroundColor: C.segmentFull },
  modeTxt: {
    color: C.textDim,
    fontFamily: FONTS.label,
    fontSize: 12,
    letterSpacing: 1,
  },
  modeTxtOn: { color: C.bg },
  appleBtn: { height: 50, width: '100%' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 6 },
  line: { flex: 1, height: 1, backgroundColor: C.segmentEmpty },
  or: { color: C.textDim, fontFamily: FONTS.label, letterSpacing: 2, fontSize: 11 },
  input: {
    backgroundColor: C.bgSoft,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.segmentEmpty,
    color: C.text,
    fontFamily: FONTS.mono,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  error: { color: C.red, fontFamily: FONTS.mono, fontSize: 12 },
  info: { color: C.segmentFull, fontFamily: FONTS.mono, fontSize: 12 },
  primary: {
    backgroundColor: C.segmentFull,
    borderRadius: RADIUS.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryTxt: {
    color: C.bg,
    fontFamily: FONTS.display,
    letterSpacing: 3,
    fontSize: 14,
  },
  toggle: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 14,
  },
});
