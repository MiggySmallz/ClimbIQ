// User-chosen color-scheme preference. Persists a System / Light / Dark choice
// and applies it app-wide. `useTheme` reads the preference to resolve its
// palette; we also push the choice to `Appearance` so native surfaces (keyboard,
// Switch, OS alerts) match the in-app theme.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'climbiq.theme-preference';

interface ThemePrefState {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

// Default is a no-op so `useTheme` (used everywhere) never throws if it somehow
// renders outside the provider; the real state comes from <ThemeProvider>.
const ThemePrefContext = createContext<ThemePrefState>({
  preference: 'system',
  setPreference: () => {},
});

function isPreference(v: string | null): v is ThemePreference {
  return v === 'system' || v === 'light' || v === 'dark';
}

/** Force native components to the chosen scheme; `system` hands control back to
 *  the OS ('unspecified' clears the override). */
function applyNative(pref: ThemePreference): void {
  Appearance.setColorScheme(pref === 'system' ? 'unspecified' : pref);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default to 'system' and hydrate the stored choice in an effect. We must NOT
  // gate rendering here (e.g. return null until loaded): that delays the
  // navigator mount below expo-router's container and trips its
  // getInitialURL().then() into updating an unmounted navigator. The splash
  // (held until the session resolves) covers the sub-millisecond hydration, so
  // there's no visible flash.
  const [preference, setPref] = useState<ThemePreference>('system');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (!active) return;
      const pref = isPreference(stored) ? stored : 'system';
      applyNative(pref);
      setPref(pref);
    });
    return () => {
      active = false;
    };
  }, []);

  function setPreference(pref: ThemePreference): void {
    setPref(pref);
    applyNative(pref);
    void AsyncStorage.setItem(STORAGE_KEY, pref);
  }

  return (
    <ThemePrefContext.Provider value={{ preference, setPreference }}>
      {children}
    </ThemePrefContext.Provider>
  );
}

export function useThemePreference(): ThemePrefState {
  return useContext(ThemePrefContext);
}
