import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSubscription } from '../store/useSubscription';
import { useAuth } from '../store/useAuth';
import { C, FONTS, RADIUS } from '../theme/colors';

// Standard Apple EULA (used unless you host your own Terms of Use).
const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const PRIVACY_URL = 'https://hydra-landing-sooty.vercel.app/privacy.html';

const VALUE_PROPS = [
  ['🩸', 'Ta barre de vie', 'Une barre qui se vide en temps réel. Bois pour la remplir.'],
  ['☠️', 'L’alcool est un poison', 'Chaque verre accélère ta déshydratation. Vois l’impact réel.'],
  ['🔒', 'Widget écran verrouillé', 'Ton hydratation en permanence sous les yeux, sans ouvrir l’app.'],
  ['📊', 'Moteur physiologique', 'Calculs basés sur ton corps et la vraie science, pas des points au hasard.'],
];

interface Props {
  // Jump to the account screen from the paywall (returning users reinstalling,
  // or the App Store reviewer signing into the test account). Only wired when
  // the user isn't signed in yet.
  onRequestSignIn?: () => void;
}

export function PaywallScreen({ onRequestSignIn }: Props = {}) {
  const { packages, purchase, restore, loadOfferings } =
    useSubscription();
  const { signOut, status: authStatus } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOfferings();
  }, [loadOfferings]);

  const pkg = packages[0] ?? null;
  const priceLabel = pkg?.product.priceString ?? '3,99 €';

  const onStart = async () => {
    setError(null);
    if (!pkg) {
      setError('Offre indisponible pour le moment. Réessaie dans un instant.');
      return;
    }
    setBusy(true);
    const r = await purchase(pkg);
    setBusy(false);
    if (!r.ok && r.message) setError(r.message);
  };

  const onRestore = async () => {
    setError(null);
    setBusy(true);
    const r = await restore();
    setBusy(false);
    if (!r.ok && r.message) setError(r.message);
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.brand}>HYDRA</Text>
        <Text style={styles.tag}>Passe le moins de temps possible à sec.</Text>

        <View style={styles.props}>
          {VALUE_PROPS.map(([icon, title, desc]) => (
            <View key={title} style={styles.prop}>
              <Text style={styles.propIcon}>{icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.propTitle}>{title}</Text>
                <Text style={styles.propDesc}>{desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.offer}>
          <Text style={styles.offerBig}>7 JOURS GRATUITS</Text>
          <Text style={styles.offerSub}>
            puis {priceLabel}/mois · annulable à tout moment
          </Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.cta, busy && { opacity: 0.6 }]}
          onPress={onStart}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={C.bg} />
          ) : (
            <Text style={styles.ctaTxt}>COMMENCER L'ESSAI GRATUIT</Text>
          )}
        </Pressable>

        <Pressable onPress={onRestore} disabled={busy} hitSlop={8}>
          <Text style={styles.restore}>Restaurer mes achats</Text>
        </Pressable>

        {authStatus === 'signedOut' && onRequestSignIn ? (
          <Pressable onPress={onRequestSignIn} disabled={busy} hitSlop={8}>
            <Text style={styles.signIn}>Déjà un compte ? Se connecter</Text>
          </Pressable>
        ) : null}

        <Text style={styles.legal}>
          L'essai gratuit dure 7 jours. Sans annulation au moins 24 h avant la
          fin, l'abonnement se renouvelle automatiquement à {priceLabel}/mois.
          Gère ou annule l'abonnement dans les réglages de ton compte Apple.
        </Text>

        <View style={styles.links}>
          <Pressable onPress={() => Linking.openURL(TERMS_URL)} hitSlop={8}>
            <Text style={styles.link}>Conditions</Text>
          </Pressable>
          <Text style={styles.linkSep}>·</Text>
          <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} hitSlop={8}>
            <Text style={styles.link}>Confidentialité</Text>
          </Pressable>
          {/* Only meaningful once an account exists — during the funnel the user
              reaches the paywall before signing in. */}
          {authStatus === 'signedIn' ? (
            <>
              <Text style={styles.linkSep}>·</Text>
              <Pressable onPress={() => signOut()} hitSlop={8}>
                <Text style={styles.link}>Se déconnecter</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 24, paddingTop: 48, paddingBottom: 40 },
  brand: {
    color: C.segmentFull,
    fontFamily: FONTS.display,
    fontSize: 44,
    letterSpacing: 12,
    textAlign: 'center',
  },
  tag: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 26,
  },
  props: { gap: 16, marginBottom: 26 },
  prop: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  propIcon: { fontSize: 22, width: 28, textAlign: 'center' },
  propTitle: {
    color: C.text,
    fontFamily: FONTS.label,
    letterSpacing: 1.5,
    fontSize: 13,
  },
  propDesc: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  offer: {
    backgroundColor: C.bgSoft,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: C.segmentFull,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 18,
  },
  offerBig: {
    color: C.segmentFull,
    fontFamily: FONTS.display,
    fontSize: 24,
    letterSpacing: 3,
  },
  offerSub: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 12,
    marginTop: 6,
  },
  error: { color: C.red, fontFamily: FONTS.mono, fontSize: 12, marginBottom: 10 },
  cta: {
    backgroundColor: C.segmentFull,
    borderRadius: RADIUS.md,
    paddingVertical: 17,
    alignItems: 'center',
  },
  ctaTxt: {
    color: C.bg,
    fontFamily: FONTS.display,
    letterSpacing: 2,
    fontSize: 15,
  },
  restore: {
    color: C.text,
    fontFamily: FONTS.mono,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
  },
  signIn: {
    color: C.segmentFull,
    fontFamily: FONTS.mono,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 14,
  },
  legal: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 20,
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
  },
  link: { color: C.textDim, fontFamily: FONTS.mono, fontSize: 11 },
  linkSep: { color: C.segmentEmpty, fontFamily: FONTS.mono, fontSize: 11 },
});
