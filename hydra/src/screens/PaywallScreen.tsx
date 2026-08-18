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
import type { PurchasesPackage } from 'react-native-purchases';
import { useSubscription } from '../store/useSubscription';
import { useAuth } from '../store/useAuth';
import { track, EV } from '../analytics/analytics';
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

// ─────────────────────────────────────────────────────────────────────────────
// Choisir l'offre par TYPE, jamais par index.
//
// Le paywall lisait `packages[0]`. Le jour où l'offre annuelle a été ajoutée
// dans RevenueCat, ce premier élément est passé du mensuel à l'annuel : les
// utilisateurs ont vu « 34,99 €/MOIS », sans essai gratuit, parce que le
// suffixe « /MOIS » était écrit en dur et que l'annuel n'a pas d'offre
// d'introduction. Trois personnes ont vu cet écran les 16 et 17 août, aucune
// n'a touché le bouton — et Apple Search Ads a rapporté zéro essai démarré,
// ce qui était exact au mot près : l'app n'en proposait plus.
// ─────────────────────────────────────────────────────────────────────────────

type PlanType = 'MONTHLY' | 'ANNUAL';

function findPackage(
  packages: PurchasesPackage[],
  type: PlanType
): PurchasesPackage | null {
  return packages.find((p) => p.packageType === type) ?? null;
}

/** L'unité de période vient du package, jamais d'une constante. */
function periodLabel(pkg: PurchasesPackage | null): {
  short: string;
  long: string;
} {
  return pkg?.packageType === 'ANNUAL'
    ? { short: 'AN', long: 'an' }
    : { short: 'MOIS', long: 'mois' };
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
  // Un message d'achat n'est pas toujours une erreur : un paiement en attente
  // de validation bancaire est une bonne nouvelle mal habillée. Deux tons.
  const [msg, setMsg] = useState<{ text: string; tone: 'error' | 'info' } | null>(
    null
  );
  const [sourcesOpen, setSourcesOpen] = useState(false);
  // Le mensuel est le défaut : c'est lui qui porte les 7 jours d'essai, donc
  // celui qui fait démarrer le tunnel. L'annuel se choisit, il ne s'impose pas.
  const [plan, setPlan] = useState<PlanType>('MONTHLY');

  useEffect(() => {
    track(EV.paywallViewed);
    loadOfferings();
  }, [loadOfferings]);

  const monthly = findPackage(packages, 'MONTHLY');
  const annual = findPackage(packages, 'ANNUAL');
  // Repli en cascade : si RevenueCat sert des identifiants personnalisés, aucun
  // des deux types attendus n'existe — mieux vaut alors la première offre venue
  // qu'un paywall sans prix.
  const pkg =
    (plan === 'ANNUAL' ? annual : monthly) ??
    monthly ??
    annual ??
    packages[0] ??
    null;
  const period = periodLabel(pkg);
  const priceLabel = pkg?.product.priceString ?? '3,99 €';
  const trialLabel = freeTrialLabel(pkg?.product.introPrice ?? null);

  // Une offre qui ne se résout pas affiche un paywall sans prix ni durée
  // d'essai : l'utilisateur ne peut rien acheter et repart. Invisible jusqu'ici,
  // et un candidat sérieux pour une part des abandons.
  //
  // Dépendances sur l'IDENTIFIANT du package et non sur l'objet : RevenueCat en
  // renvoie une nouvelle instance à chaque lecture, ce qui doublait l'événement.
  useEffect(() => {
    track(EV.paywallOfferLoaded, {
      has_package: pkg !== null,
      plan: pkg?.packageType ?? null,
      price: pkg?.product.priceString ?? null,
      period: period.long,
      trial: trialLabel,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkg?.identifier, period.long, trialLabel]);

  const onStart = async () => {
    setMsg(null);
    track(EV.paywallStartTapped, {
      has_package: pkg !== null,
      plan: pkg?.packageType ?? null,
      trial: trialLabel,
    });
    if (!pkg) {
      setMsg({
        text: 'Offre indisponible pour le moment. Réessaie dans un instant.',
        tone: 'error',
      });
      track(EV.paywallPurchaseFailed, { outcome: 'error', code: 'no_package' });
      return;
    }
    setBusy(true);
    const r = await purchase(pkg);
    setBusy(false);
    setMsg(
      r.message
        ? { text: r.message, tone: r.outcome === 'pending' ? 'info' : 'error' }
        : null
    );
    // `outcome` sépare enfin les quatre issues. Un paiement `pending` est compté
    // ici comme un échec d'achat immédiat — c'en est un du point de vue du
    // tunnel — mais la propriété permet de le sortir du dénominateur : il peut
    // aboutir plus tard, sans que l'utilisateur retouche à quoi que ce soit.
    track(r.ok ? EV.paywallPurchaseOk : EV.paywallPurchaseFailed, {
      outcome: r.outcome,
      code: r.code || null,
      plan: pkg.packageType,
    });
  };

  const onRestore = async () => {
    setMsg(null);
    track(EV.paywallRestoreTapped);
    setBusy(true);
    const r = await restore();
    setBusy(false);
    setMsg(r.message ? { text: r.message, tone: 'error' } : null);
    // Sans ce résultat, on a vu quelqu'un taper neuf fois en cinq secondes sans
    // savoir ce que l'app lui répondait à chaque fois.
    track(EV.paywallRestoreResult, { outcome: r.outcome, code: r.code || null });
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
            {trialLabel ?? `${priceLabel}/${period.short}`}
          </Text>
          <Text style={styles.offerSub}>
            {trialLabel
              ? `puis ${priceLabel}/${period.long} · annulable à tout moment`
              : `${priceLabel}/${period.long} · annulable à tout moment`}
          </Text>
        </View>

        {/* Le choix ne s'affiche que si les deux offres existent réellement.
            Un sélecteur à une seule branche n'est qu'un bouton mort de plus. */}
        {monthly && annual ? (
          <View style={styles.plans}>
            {([
              ['MONTHLY', monthly, 'MENSUEL', 'mois'],
              ['ANNUAL', annual, 'ANNUEL', 'an'],
            ] as const).map(([type, p, title, unit]) => {
              const on = plan === type;
              return (
                <Pressable
                  key={type}
                  style={[styles.plan, on && styles.planOn]}
                  disabled={busy}
                  onPress={() => {
                    setPlan(type);
                    track(EV.paywallPlanSelected, { plan: type });
                  }}
                >
                  <Text style={[styles.planTitle, on && styles.planTitleOn]}>
                    {title}
                  </Text>
                  <Text style={styles.planPrice}>
                    {p.product.priceString}/{unit}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

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

        {msg ? (
          <Text style={msg.tone === 'info' ? styles.notice : styles.error}>
            {msg.text}
          </Text>
        ) : null}

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
            ? `Essai gratuit de ${trialLabel.toLowerCase()}. Sans annulation au moins 24 h avant la fin, l'abonnement se renouvelle automatiquement à ${priceLabel}/${period.long}. `
            : `Abonnement à ${priceLabel}/${period.long}, renouvelé automatiquement sauf annulation au moins 24 h avant la fin de la période. `}
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
  plans: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  plan: {
    flex: 1,
    backgroundColor: C.bgSoft,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.segmentEmpty,
    paddingVertical: 12,
    alignItems: 'center',
  },
  planOn: { borderColor: C.segmentFull },
  planTitle: {
    color: C.textDim,
    fontFamily: FONTS.label,
    letterSpacing: 1.5,
    fontSize: 12,
  },
  planTitleOn: { color: C.segmentFull },
  planPrice: {
    color: C.text,
    fontFamily: FONTS.mono,
    fontSize: 12,
    marginTop: 4,
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
  // Même emplacement que l'erreur, ton opposé : ce message dit « ça avance ».
  notice: {
    color: C.segmentFull,
    fontFamily: FONTS.mono,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
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
