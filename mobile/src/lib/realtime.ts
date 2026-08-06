// Supabase realtime helper.
//
// Supabase dedupes channels by topic name, so two subscriptions to the same name
// share one instance — and a second `.on('postgres_changes', …)` after subscribe
// throws. This bites when a hook mounts in two places at once, or on a dev
// double-mount. `uniqueTopic(base)` suffixes a monotonic counter so every
// subscription gets its own channel.

let seq = 0;

export function uniqueTopic(base: string): string {
  seq += 1;
  return `${base}-${seq}`;
}
