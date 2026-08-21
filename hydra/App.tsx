import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { AppState, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HomeScreen } from './src/screens/HomeScreen';
import { DataScreen } from './src/screens/DataScreen';
import { WidgetsScreen } from './src/screens/WidgetsScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { PaywallScreen } from './src/screens/PaywallScreen';
import { C, FONTS } from './src/theme/colors';
import { useLocale, useLocaleStore, useT } from './src/i18n';
import { ensurePermissions } from './src/notifications/scheduler';
import { initAnalytics, flushAnalytics } from './src/analytics/analytics';
import { useHydration } from './src/store/useHydration';
import { useAuth } from './src/store/useAuth';
import { useSubscription } from './src/store/useSubscription';
import { startSync } from './src/sync/cloudSync';

const Tab = createBottomTabNavigator();

function Splash({ note }: { note?: string } = {}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: C.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: C.segmentFull,
          fontFamily: FONTS.display,
          fontSize: 40,
          letterSpacing: 10,
        }}
      >
        HYDRA
      </Text>
      {/* Several seconds of a bare wordmark reads as a freeze, so any wait long
          enough to notice says what it is waiting for. */}
      {note ? (
        <Text
          style={{
            color: C.textDim,
            fontFamily: FONTS.mono,
            fontSize: 12,
            marginTop: 14,
          }}
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}


export default function App() {
  const [fontsLoaded] = useFonts({
    'ChakraPetch-Bold': require('./assets/fonts/ChakraPetch-Bold.ttf'),
    'ChakraPetch-SemiBold': require('./assets/fonts/ChakraPetch-SemiBold.ttf'),
    'IBMPlexMono-Regular': require('./assets/fonts/IBMPlexMono-Regular.ttf'),
    'IBMPlexMono-Bold': require('./assets/fonts/IBMPlexMono-Bold.ttf'),
  });

  const onboarded = useHydration((s) => s.onboarded);
  const reconfiguring = useHydration((s) => s.reconfiguring);
  const widgetGuideSeen = useHydration((s) => s.widgetGuideSeen);
  const authStatus = useAuth((s) => s.status);
  const userId = useAuth((s) => s.user?.id ?? null);
  const subStatus = useSubscription((s) => s.status);
  const [storeHydrated, setStoreHydrated] = useState(
    useHydration.persist.hasHydrated()
  );
  // Lets a signed-out user open the account screen straight from the paywall
  // (returning users reinstalling, or the App Store reviewer signing in).
  const [wantsSignIn, setWantsSignIn] = useState(false);

  // Premier onglet du tout premier lancement : WIDGETS, pas BARRE.
  //
  // Ce que la publicité vend, c'est la barre de vie sur l'écran verrouillé —
  // et l'y mettre demande cinq gestes iOS qu'on ne devine pas. Déposer les
  // nouveaux venus sur l'accueil leur donne un compteur d'eau et laisse la
  // promesse non tenue ; l'onglet WIDGETS ouvre le guide directement.
  //
  // Figé au montage : React Navigation ignore les changements ultérieurs de
  // `initialRouteName`, et WidgetsScreen lève le drapeau dès l'ouverture du
  // guide. Sans ce gel, la valeur changerait sous les pieds du navigateur.
  const [initialTab] = useState(() => (widgetGuideSeen ? 'BARRE' : 'WIDGETS'));

  // Signing in makes the detour above obsolete, and leaving it set is what App
  // Review reported twice as "no action took place": the sign-in branch requires
  // signedOut, so once authenticated it stops matching and the questionnaire
  // renders instead — while its "Déjà un compte ?" link stayed on screen. Tapping
  // it re-set a flag that was already true, so React re-rendered nothing and the
  // link was simply dead. Clearing the flag keeps the two in step.
  useEffect(() => {
    if (authStatus !== 'signedOut') setWantsSignIn(false);
  }, [authStatus]);

  // What actually flips `onboarded` for a returning user is the first cloud pull,
  // which lands a beat after auth resolves. Without a grace period they are
  // dropped back into the questionnaire they already completed (exactly the
  // "renvoyé sur BIENVENUE" loop). Bounded: an empty or failed pull falls through
  // to the questionnaire rather than stranding anyone on the splash.
  const tr = useT();
  const locale = useLocale();
  // Même motif que `storeHydrated` ci-dessus : `onFinishHydration` se déclenche
  // aussi en cas d'échec de lecture, donc l'app démarre toujours.
  const [localeHydrated, setLocaleHydrated] = useState(() =>
    useLocaleStore.persist.hasHydrated()
  );
  useEffect(
    () => useLocaleStore.persist.onFinishHydration(() => setLocaleHydrated(true)),
    []
  );

  const [awaitingSync, setAwaitingSync] = useState(false);
  useEffect(() => {
    if (authStatus !== 'signedIn' || onboarded) {
      setAwaitingSync(false);
      return;
    }
    setAwaitingSync(true);
    const id = setTimeout(() => setAwaitingSync(false), 5000);
    return () => clearTimeout(id);
  }, [authStatus, onboarded]);


  useEffect(() => {
    initAnalytics();
    ensurePermissions().catch(() => {});
    // Bring up auth, then wire cloud sync (sign-in + debounced local changes).
    useAuth
      .getState()
      .init()
      .then(() => startSync())
      .catch(() => {});
    const unsub = useHydration.persist.onFinishHydration(() =>
      setStoreHydrated(true)
    );
    setStoreHydrated(useHydration.persist.hasHydrated());
    return unsub;
  }, []);

  // Merge any events the iOS widget logged (App Intents) whenever the app comes
  // back to the foreground. Gated on hydration so the first pull runs after the
  // persisted state is loaded (and after the rehydrate-time pull).
  useEffect(() => {
    if (!storeHydrated) return;
    const pull = () =>
      useHydration.getState().pullFromWidget().catch(() => {});
    pull();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') pull();
      // iOS peut suspendre le processus avant l'envoi périodique : on vide la
      // file en partant, sinon les abandons — précisément ce qu'on cherche à
      // mesurer — seraient les événements les plus souvent perdus.
      else flushAnalytics();
    });
    return () => sub.remove();
  }, [storeHydrated]);

  // Configure RevenueCat: anonymously as soon as auth resolves to signed-out
  // (so the paywall works during the onboarding funnel, before an account
  // exists), then link it to the account once the user signs in at the end.
  useEffect(() => {
    if (authStatus === 'signedIn' && userId) {
      useSubscription.getState().init(userId).catch(() => {});
    } else if (authStatus === 'signedOut') {
      useSubscription.getState().init().catch(() => {});
    }
  }, [authStatus, userId]);

  // Changer de langue ne suffit PAS à traduire ce qui vit hors de React : le
  // widget natif lit son texte dans le snapshot de l'App Group, et les
  // notifications sont écrites au moment où elles sont programmées — donc
  // celles déjà en file portent encore l'ancienne langue. `_sync` réécrit le
  // snapshot et replanifie tout, ce qui règle les deux d'un coup.
  useEffect(() => {
    if (!storeHydrated) return;
    useHydration.getState()._sync().catch(() => {});
  }, [locale, storeHydrated]);

  // Attendre AUSSI la langue persistée. Sans ce verrou, le premier rendu se
  // fait dans la langue de l'appareil, puis bascule : quelqu'un qui a choisi
  // l'anglais sur un iPhone français verrait le questionnaire clignoter en
  // français à chaque lancement.
  if (
    !fontsLoaded ||
    !storeHydrated ||
    !localeHydrated ||
    authStatus === 'loading'
  ) {
    return <Splash />;
  }

  // Just signed in, cloud profile not merged yet — hold rather than flash the
  // questionnaire at someone who already finished it. Self-releases after 5 s.
  if (awaitingSync) {
    return <Splash note={tr('splash.loadingProfile')} />;
  }

  // Returning user / reviewer: jump to sign-in even before the questionnaire
  // (e.g. after sign-out wiped local data).
  if (authStatus === 'signedOut' && wantsSignIn) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          {/* Sign-in only: this screen is reached from a "Déjà un compte ?"
              link, and signing UP here creates an account with no subscription
              — the router then bounces the user back to the paywall. */}
          <AuthScreen
            initialMode="signIn"
            allowSignUp={false}
            onBack={() => setWantsSignIn(false)}
          />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  // Onboarding funnel (show value first, then ask to pay, then the account):
  //   1) questionnaire  →  2) paywall  →  3) create account  →  app
  // The questionnaire runs with no account; its answers live in the local store
  // and get pushed to the cloud once the user signs in at the end.

  // 1) Not onboarded → the questionnaire, straight away (no account needed).
  //    reconfiguring = "Refaire le questionnaire" from settings (onboarded stays true).
  if (!onboarded || reconfiguring) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <OnboardingScreen
            // Signed out only: offering "I already have an account" to someone
            // who IS signed in produced a link that could not do anything.
            onHaveAccount={
              !onboarded && authStatus === 'signedOut'
                ? () => setWantsSignIn(true)
                : undefined
            }
            // …and once signed in with an account that carries no cloud profile
            // (a fresh Apple ID, say), the questionnaire is the right screen —
            // but there must still be a way back out to another account.
            onSignOut={
              authStatus === 'signedIn' ? () => useAuth.getState().signOut() : undefined
            }
          />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  // Subscription (anonymous at this stage) still resolving → brief splash.
  if (subStatus === 'loading') {
    return <Splash />;
  }

  // 2) Account screen — shown when signed out AND the anonymous trial is
  //    already active (new user finishing the funnel → create an account to
  //    save progress). onBack is unused here (trial already active).
  if (authStatus === 'signedOut' && subStatus === 'active') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <AuthScreen initialMode="signUp" />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  // 3) No active subscription/trial → hard paywall (no free access). Signed-out
  //    users get a shortcut to sign in (for an existing account).
  if (subStatus === 'inactive') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <PaywallScreen onRequestSignIn={() => setWantsSignIn(true)} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer
          theme={{
            dark: true,
            colors: {
              primary: C.segmentFull,
              background: C.bg,
              card: C.bg,
              text: C.text,
              border: C.bgSoft,
              notification: C.red,
            },
          }}
        >
          <StatusBar style="light" />
          <Tab.Navigator
            initialRouteName={initialTab}
            screenOptions={{
              headerShown: false,
              tabBarStyle: {
                backgroundColor: C.bg,
                borderTopColor: C.bgSoft,
              },
              tabBarActiveTintColor: C.segmentFull,
              tabBarInactiveTintColor: C.textDim,
              tabBarLabelStyle: {
                fontFamily: FONTS.label,
                letterSpacing: 2,
                fontSize: 10,
              },
            }}
          >
            {/* `name` reste l'IDENTIFIANT de route et ne se traduit pas :
                `initialRouteName` s'appuie dessus, et une route renommée avec
                la langue enverrait le premier lancement anglais nulle part.
                Seul `tabBarLabel` est traduit. */}
            <Tab.Screen
              name="BARRE"
              component={HomeScreen}
              options={{
                tabBarLabel: tr('tab.bar'),
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="water" size={size} color={color} />
                ),
              }}
            />
            <Tab.Screen
              name="DONNÉES"
              component={DataScreen}
              options={{
                tabBarLabel: tr('tab.data'),
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="stats-chart" size={size} color={color} />
                ),
              }}
            />
            <Tab.Screen
              name="WIDGETS"
              component={WidgetsScreen}
              options={{
                tabBarLabel: tr('tab.widgets'),
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="apps" size={size} color={color} />
                ),
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
