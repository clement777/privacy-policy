import { create } from 'zustand';
import { Platform } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '../lib/supabase';
import { useHydration } from './useHydration';
import { useSubscription } from './useSubscription';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export type AuthResult = { ok: true } | { ok: false; message: string };

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  appleAvailable: boolean;

  init: () => Promise<void>;
  signInWithApple: () => Promise<AuthResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<AuthResult>;
}

// Human-readable French errors (Supabase messages are English/technical).
function humanize(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'Email ou mot de passe incorrect.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Un compte existe déjà avec cet email.';
  if (m.includes('password should be at least'))
    return 'Le mot de passe doit faire au moins 6 caractères.';
  if (m.includes('unable to validate email') || m.includes('invalid email'))
    return 'Adresse email invalide.';
  if (m.includes('email not confirmed'))
    return 'Confirme ton email avant de te connecter.';
  if (m.includes('network')) return 'Pas de connexion. Réessaie.';
  return message;
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'loading',
  session: null,
  user: null,
  appleAvailable: false,

  async init() {
    // Apple sign-in is only available on a native iOS build (not Expo Go / web).
    if (Platform.OS === 'ios') {
      try {
        set({ appleAvailable: await AppleAuthentication.isAvailableAsync() });
      } catch {
        set({ appleAvailable: false });
      }
    }

    const { data } = await supabase.auth.getSession();
    set({
      session: data.session,
      user: data.session?.user ?? null,
      status: data.session ? 'signedIn' : 'signedOut',
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        status: session ? 'signedIn' : 'signedOut',
      });
    });
  },

  async signInWithApple() {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        return { ok: false, message: 'Connexion Apple annulée.' };
      }
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) return { ok: false, message: humanize(error.message) };
      return { ok: true };
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === 'ERR_REQUEST_CANCELED') {
        return { ok: false, message: 'Connexion Apple annulée.' };
      }
      return { ok: false, message: humanize(err.message ?? 'Erreur Apple.') };
    }
  },

  async signInWithEmail(email, password) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return { ok: false, message: humanize(error.message) };
    return { ok: true };
  },

  async signUpWithEmail(email, password) {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) return { ok: false, message: humanize(error.message) };
    return { ok: true };
  },

  async signOut() {
    // Auth first so cloud sync won't push during the local wipe.
    await supabase.auth.signOut();
    set({ session: null, user: null, status: 'signedOut' });
    try {
      await useSubscription.getState().logOut();
    } catch {
      /* RevenueCat optional */
    }
    try {
      await useHydration.getState().resetLocalData();
    } catch {
      /* still signed out */
    }
  },

  // Calls the `delete-account` Edge Function (service-role side), which removes
  // the auth user; profiles/events cascade-delete. Then signs out locally.
  async deleteAccount() {
    try {
      const { error } = await supabase.functions.invoke('delete-account');
      if (error) return { ok: false, message: humanize(error.message) };
      await get().signOut();
      return { ok: true };
    } catch (e: unknown) {
      const err = e as { message?: string };
      return { ok: false, message: humanize(err.message ?? 'Suppression impossible.') };
    }
  },
}));
