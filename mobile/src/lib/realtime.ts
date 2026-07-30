// Supabase realtime helper.
//
// Supabase dedupes channels by topic name: calling `supabase.channel(name)` twice
// with the same name returns the SAME channel instance. If that instance is
// already subscribed, a second `.on('postgres_changes', …)` throws "cannot add
// postgres_changes callbacks after subscribe()". This bites whenever a hook is
// mounted in two places at once (e.g. a badge + a screen) or on a dev
// double-mount where `removeChannel` from the first mount hasn't completed before
// the second re-creates the topic.
//
// `uniqueTopic(base)` suffixes a process-monotonic counter so every subscription
// gets its own channel. Cleanup still removes the exact channel it created.

let seq = 0;

export function uniqueTopic(base: string): string {
  seq += 1;
  return `${base}-${seq}`;
}
