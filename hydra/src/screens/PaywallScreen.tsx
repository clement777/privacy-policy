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
import { StringKey, useT } from '../i18n';

type Translate = (key: StringKey, params?: Record<string, string | number>) => string;

// Standard Apple EULA (used unless you host your own Terms of Use).
const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const PRIVACY_URL = 'https://hydra-landing-sooty.vercel.app/privacy.html';

const VALUE_PROPS: { icon: string; title: StringKey; desc: StringKey }[] = [
  { icon: '🩸', title: 'pay.prop1.title', desc: 'pay.prop1.desc' },
  { icon: '☠️', title: 'pay.prop2.title', desc: 'pay.prop2.desc' },
  { icon: '🔒', title: 'pay.prop3.title', desc: 'pay.prop3.desc' },
  { icon: '📊', title: 'pay.prop4.title', desc: 'pay.prop4.desc' },
];

// The introductory offer as StoreKit actually reports it. We must never promise
// a free trial the payment sheet won't show: App Review rejected 1.0(5) under
// guideline 2.1(b) precisely because the screen advertised 7 free days that the
// purchase sheet didn't mention. So the offer copy is derived from the product,
// never hard-coded — if the introductory offer is missing or misconfigured in
// App Store Connect, the paywall degrades to plain pricing instead of lying.
function freeTrialLabel(
  intro: {
    price: number;
    periodUnit: string;
    periodNumberOfUnits: number;
  } | null,
  tr: Translate
): string | null {
  if (!intro || intro.price > 0) return null;
  const n = intro.periodNumberOfUnits;
  // `{s}` porte le pluriel dans les deux langues — français et anglais ajoutent
  // tous deux un S. Une langue à pluriel irrégulier demanderait mieux ; aucune
  // n'est livrée aujourd'hui, et prétendre le contraire serait du décor.
  const s = n > 1 ? 'S' : '';
  switch (intro.periodUnit) {
    case 'DAY':
      return tr('pay.trialDays', { n, s });
    case 'WEEK':
      return tr('pay.trialWeeks', { n: n * 7 });
    case 'MONTH':
      return tr('pay.trialMonths', { n, s });
    case 'YEAR':
      return tr('pay.trialYears', { n, s });
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
function periodLabel(
  pkg: PurchasesPackage | null,
  tr: Translate
): { short: string; long: string } {
  return pkg?.packageType === 'ANNUAL'
    ? { short: tr('pay.periodYearShort'), long: tr('pay.periodYear') }
    : { short: tr('pay.periodMonthShort'), long: tr('pay.periodMonth') };
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
  const tr = useT();
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
  const period = periodLabel(pkg, tr);
  const priceLabel = pkg?.product.priceString ?? '3,99 €';
  const trialLabel = freeTrialLabel(pkg?.product.introPrice ?? null, tr);

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
      setMsg({ text: tr('pay.noOffer'), tone: 'error' });
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
        <Text style={styles.tag}>{tr('pay.tagline')}</Text>

        <View style={styles.props}>
          {VALUE_PROPS.map((p) => (
            <View key={p.title} style={styles.prop}>
              <Text style={styles.propIcon}>{p.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.propTitle}>{tr(p.title)}</Text>
                <Text style={styles.propDesc}>{tr(p.desc)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.offer}>
          <Text style={styles.offerBig}>
            {trialLabel ??
              tr('pay.perPeriod', { price: priceLabel, period: period.short })}
          </Text>
          <Text style={styles.offerSub}>
            {tr(trialLabel ? 'pay.thenPerPeriod' : 'pay.plainPeriod', {
              price: priceLabel,
              period: period.long,
            })}
          </Text>
        </View>

        {/* Le choix ne s'affiche que si les deux offres existent réellement.
            Un sélecteur à une seule branche n'est qu'un bouton mort de plus. */}
        {monthly && annual ? (
          <View style={styles.plans}>
            {([
              ['MONTHLY', monthly, 'pay.planMonthly', 'pay.periodMonth'],
              ['ANNUAL', annual, 'pay.planAnnual', 'pay.periodYear'],
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
                    {tr(title)}
                  </Text>
                  <Text style={styles.planPrice}>
                    {p.product.priceString}/{tr(unit)}
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
          <Text style={styles.accountNote}>{tr('pay.accountNote')}</Text>
        ) : null}

        <Text style={styles.access}>{tr('pay.access')}</Text>

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
              {tr(trialLabel ? 'pay.ctaTrial' : 'pay.ctaSubscribe')}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={onRestore} disabled={busy} hitSlop={8}>
          <Text style={styles.restore}>{tr('pay.restore')}</Text>
        </Pressable>

        {authStatus === 'signedOut' && onRequestSignIn ? (
          <Pressable onPress={onRequestSignIn} disabled={busy} hitSlop={8}>
            <Text style={styles.signIn}>{tr('pay.signIn')}</Text>
          </Pressable>
        ) : null}

        <Text style={styles.legal}>
          {trialLabel
            ? tr('pay.legalTrial', {
                trial: trialLabel.toLowerCase(),
                price: priceLabel,
                period: period.long,
              })
            : tr('pay.legalPlain', {
                price: priceLabel,
                period: period.long,
              })}
          {tr('pay.legalManage')}
        </Text>

        <View style={styles.links}>
          <Pressable onPress={() => Linking.openURL(TERMS_URL)} hitSlop={8}>
            <Text style={styles.link}>{tr('pay.terms')}</Text>
          </Pressable>
          <Text style={styles.linkSep}>·</Text>
          <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} hitSlop={8}>
            <Text style={styles.link}>{tr('pay.privacy')}</Text>
          </Pressable>
          <Text style={styles.linkSep}>·</Text>
          {/* Citations must be reachable without subscribing (guideline 1.4.1). */}
          <Pressable onPress={() => setSourcesOpen(true)} hitSlop={8}>
            <Text style={styles.link}>{tr('pay.sourcesLink')}</Text>
          </Pressable>
          {/* Only meaningful once an account exists — during the funnel the user
              reaches the paywall before signing in. */}
          {authStatus === 'signedIn' ? (
            <>
              <Text style={styles.linkSep}>·</Text>
              <Pressable onPress={() => signOut()} hitSlop={8}>
                <Text style={styles.link}>{tr('pay.signOut')}</Text>
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
