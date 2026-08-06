import { useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@climbiq/shared';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { getAdminWhoami } from '@/services/admin';
import { getProfile } from '@/services/profiles';

interface AuthState {
  /** Undefined while the initial session/profile load is in flight. */
  session: Session | null | undefined;
  profile: Profile | null;
  /** Whether the signed-in account is the project owner. Established once when the
   *  session resolves so admin-only UI can show immediately, everywhere. */
  isAdmin: boolean;
  /** Call after writing the profiles row so guards see it without a re-login. */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
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

  const loadAdmin = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setIsAdmin(false);
      return;
    }
    try {
      const { admin } = await getAdminWhoami();
      setIsAdmin(admin);
    } catch {
      // A transient failure of the probe just leaves admin UI hidden this session
      // (it retries on the next auth event); it never falsely grants access.
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      prevUserIdRef.current = data.session?.user.id;
      await Promise.all([loadProfile(data.session?.user.id), loadAdmin(data.session?.user.id)]);
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
      await Promise.all([loadProfile(newUserId), loadAdmin(newUserId)]);
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile, loadAdmin, qc]);

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await loadProfile(data.session?.user.id);
  }, [loadProfile]);

  return (
    <AuthContext.Provider value={{ session, profile, isAdmin, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
