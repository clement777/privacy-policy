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
import { ensurePermissions } from './src/notifications/scheduler';
import { useHydration } from './src/store/useHydration';
import { useAuth } from './src/store/useAuth';
import { useSubscription } from './src/store/useSubscription';
import { startSync } from './src/sync/cloudSync';

const Tab = createBottomTabNavigator();

function Splash() {
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
  const authStatus = useAuth((s) => s.status);
  const userId = useAuth((s) => s.user?.id ?? null);
  const subStatus = useSubscription((s) => s.status);
  const [storeHydrated, setStoreHydrated] = useState(
    useHydration.persist.hasHydrated()
  );

  useEffect(() => {
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

  // Wait for fonts, persisted state AND auth before deciding what to show.
  if (!fontsLoaded || !storeHydrated || authStatus === 'loading') {
    return <Splash />;
  }

  // Onboarding funnel (show value first, then ask to pay, then the account):
  //   1) questionnaire  →  2) paywall  →  3) create account  →  app
  // The questionnaire runs with no account; its answers live in the local store
  // and get pushed to the cloud once the user signs in at the end.

  // 1) Not onboarded → the questionnaire, straight away (no account needed).
  if (!onboarded) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <OnboardingScreen />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  // Subscription (anonymous at this stage) still resolving → brief splash.
  if (subStatus === 'loading') {
    return <Splash />;
  }

  // 2) No active subscription/trial → hard paywall (no free access).
  if (subStatus === 'inactive') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <PaywallScreen />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  // 3) Trial/subscription active but no account yet → create it to save
  //    progress (this also links the anonymous trial to the account).
  if (authStatus === 'signedOut') {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <AuthScreen />
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
            <Tab.Screen
              name="BARRE"
              component={HomeScreen}
              options={{
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="water" size={size} color={color} />
                ),
              }}
            />
            <Tab.Screen
              name="DONNÉES"
              component={DataScreen}
              options={{
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="stats-chart" size={size} color={color} />
                ),
              }}
            />
            <Tab.Screen
              name="WIDGETS"
              component={WidgetsScreen}
              options={{
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
