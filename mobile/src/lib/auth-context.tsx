import { useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@climbiq/shared';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { getProfile } from '@/services/profiles';

interface AuthState {
  /** Undefined while the initial session/profile load is in flight. */
  session: Session | null | undefined;
  profile: Profile | null;
  /** Call after writing the profiles row so guards see it without a re-login. */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const qc = useQueryClient();
  // Tracks the signed-in user across auth events so we can detect an account
  // switch (or sign-out) and wipe the previous account's cached queries.
  const prevUserIdRef = useRef<string | undefined>(undefined);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    try {
      setProfile(await getProfile(userId));
    } catch {
      // Treat a failed profile read as "no profile yet"; onboarding retries the write.
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      prevUserIdRef.current = data.session?.user.id;
      await loadProfile(data.session?.user.id);
      setSession(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      const newUserId = newSession?.user.id;
      // Account switch or sign-out → drop every cached query so the new session
      // never reads the previous account's data (the owner-only admin panel, or
      // another user's climbs/feed/etc.). Token refresh keeps the same id, so it
      // won't clear.
      if (newUserId !== prevUserIdRef.current) {
        qc.clear();
        prevUserIdRef.current = newUserId;
      }
      await loadProfile(newUserId);
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile, qc]);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await loadProfile(data.session?.user.id);
  }, [loadProfile]);

  return (
    <AuthContext.Provider value={{ session, profile, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
