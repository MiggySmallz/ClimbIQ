// Orchestrator HTTP client — the only path to the backend that isn't
// Supabase-direct. Every request carries the current Supabase JWT so the
// orchestrator's auth middleware can identify the user.

import { supabase } from '@/lib/supabase';

const baseUrl = process.env.EXPO_PUBLIC_API_URL;

// Fail loudly on missing config — no silent fallbacks.
if (!baseUrl) {
  throw new Error(
    'Missing EXPO_PUBLIC_API_URL. Copy mobile/.env.example to mobile/.env and set the ' +
      'orchestrator base URL.',
  );
}

/** Base URL without a trailing slash. */
export const API_URL = baseUrl.replace(/\/+$/, '');

async function authHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('not_authenticated');
  return `Bearer ${token}`;
}

/** JSON request against the orchestrator. Throws on non-2xx (message not shown
 *  to users — screens surface their own copy). */
export async function apiFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: await authHeader(),
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`api_error_${res.status}`);
  }
  return (await res.json()) as T;
}

/** Orchestrator request with no response body (e.g. a 204). Throws on non-2xx. */
export async function apiVoid(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: await authHeader(),
      ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`api_error_${res.status}`);
  }
}
