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

export function AuthScreen() {
  const { appleAvailable, signInWithApple, signInWithEmail, signUpWithEmail } =
    useAuth();
  // The account step now comes at the END of the funnel (after onboarding +
  // paywall), so default to creating an account; returning users can toggle.
  const [mode, setMode] = useState<Mode>('signUp');
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
          <View style={styles.hero}>
            <Text style={styles.brand}>HYDRA</Text>
            <Text style={styles.tag}>
              Dernière étape : crée ton compte pour sauvegarder ta progression et
              retrouver ta barre sur tous tes appareils.
            </Text>
          </View>

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

          <Pressable
            onPress={() => {
              setMode(mode === 'signIn' ? 'signUp' : 'signIn');
              setError(null);
              setInfo(null);
            }}
            hitSlop={10}
          >
            <Text style={styles.toggle}>
              {mode === 'signIn'
                ? "Pas encore de compte ? Créer un compte"
                : 'Déjà un compte ? Se connecter'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 24, paddingTop: 60, gap: 14, minHeight: '100%' },
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
