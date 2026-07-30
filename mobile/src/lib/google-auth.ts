import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const redirectTo = Linking.createURL('auth/callback');

/**
 * Google sign-in via Supabase OAuth in the system browser (PKCE flow).
 * Requires the Google provider to be enabled in the Supabase dashboard and
 * `redirectTo` added to the project's auth redirect allow-list.
 */
export async function signInWithGoogle(): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return; // user cancelled

  const code = new URL(result.url).searchParams.get('code');
  if (!code) throw new Error('Google sign-in did not return an auth code.');

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    // The auth code is single-use. On Android the deep-link callback route
    // (auth/callback) can navigate directly and exchange it first, winning the
    // race and leaving this exchange with "Invalid flow state". That's not a
    // failure — a session already exists. Poll briefly for it before surfacing
    // the error, so a genuine failure (no session appears) still throws.
    for (let i = 0; i < 5; i += 1) {
      const { data } = await supabase.auth.getSession();
      if (data.session) return;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw exchangeError;
  }
}
