import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@climbiq/shared';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

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
      await loadProfile(data.session?.user.id);
      setSession(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      await loadProfile(newSession?.user.id);
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

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
