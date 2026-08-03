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
import { SourcesSheet } from '../components/SourcesSheet';
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

// The introductory offer as StoreKit actually reports it. We must never promise
// a free trial the payment sheet won't show: App Review rejected 1.0(5) under
// guideline 2.1(b) precisely because the screen advertised 7 free days that the
// purchase sheet didn't mention. So the offer copy is derived from the product,
// never hard-coded — if the introductory offer is missing or misconfigured in
// App Store Connect, the paywall degrades to plain pricing instead of lying.
function freeTrialLabel(intro: {
  price: number;
  periodUnit: string;
  periodNumberOfUnits: number;
} | null): string | null {
  if (!intro || intro.price > 0) return null;
  const n = intro.periodNumberOfUnits;
  switch (intro.periodUnit) {
    case 'DAY':
      return `${n} JOUR${n > 1 ? 'S' : ''} GRATUIT${n > 1 ? 'S' : ''}`;
    case 'WEEK':
      return n * 7 === 7 ? '7 JOURS GRATUITS' : `${n * 7} JOURS GRATUITS`;
    case 'MONTH':
      return `${n} MOIS GRATUIT${n > 1 ? 'S' : ''}`;
    case 'YEAR':
      return `${n} AN${n > 1 ? 'S' : ''} GRATUIT${n > 1 ? 'S' : ''}`;
    default:
      return null;
  }
}

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
  const [sourcesOpen, setSourcesOpen] = useState(false);

  useEffect(() => {
    loadOfferings();
  }, [loadOfferings]);

  const pkg = packages[0] ?? null;
  const priceLabel = pkg?.product.priceString ?? '3,99 €';
  const trialLabel = freeTrialLabel(pkg?.product.introPrice ?? null);

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
          <Text style={styles.offerBig}>
            {trialLabel ?? `${priceLabel}/MOIS`}
          </Text>
          <Text style={styles.offerSub}>
            {trialLabel
              ? `puis ${priceLabel}/mois · annulable à tout moment`
              : 'abonnement · annulable à tout moment'}
          </Text>
        </View>

        {/* A signed-in user on the paywall has an account but no subscription.
            Without a word of explanation the screen just reappears and reads as
            a loop — which is how two of the three people who completed the
            questionnaire on 3 Aug left, account created, trial never started. */}
        {authStatus === 'signedIn' ? (
          <Text style={styles.accountNote}>
            Ton compte est bien créé. Il te reste à démarrer ton essai pour
            débloquer l'app.
          </Text>
        ) : null}

        <Text style={styles.access}>
          HYDRA est une app par abonnement : l'accès complet (barre en temps
          réel, widgets, historique) nécessite l'abonnement HYDRA Pro.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.cta, busy && { opacity: 0.6 }]}
          onPress={onStart}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={C.bg} />
          ) : (
            <Text style={styles.ctaTxt}>
              {trialLabel ? "COMMENCER L'ESSAI GRATUIT" : "S'ABONNER"}
            </Text>
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
          {trialLabel
            ? `Essai gratuit de ${trialLabel.toLowerCase()}. Sans annulation au moins 24 h avant la fin, l'abonnement se renouvelle automatiquement à ${priceLabel}/mois. `
            : `Abonnement mensuel à ${priceLabel}, renouvelé automatiquement sauf annulation au moins 24 h avant la fin de la période. `}
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
          <Text style={styles.linkSep}>·</Text>
          {/* Citations must be reachable without subscribing (guideline 1.4.1). */}
          <Pressable onPress={() => setSourcesOpen(true)} hitSlop={8}>
            <Text style={styles.link}>Sources</Text>
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

      <SourcesSheet
        visible={sourcesOpen}
        onClose={() => setSourcesOpen(false)}
      />
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
  accountNote: {
    color: C.segmentFull,
    fontFamily: FONTS.mono,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 12,
  },
  // Spells out that the app is subscription-gated (guideline 2.3.2).
  access: {
    color: C.textDim,
    fontFamily: FONTS.mono,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 16,
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
