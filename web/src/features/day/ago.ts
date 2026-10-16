// Day clock labels are 'HH:MM' (shared/types.ts arrivesAt). Minutes since midnight, or null.
export const minutes = (label: string): number | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(label);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

// The lock's relative time for a message that arrived at `at` when the clock reads `clock`:
// "now", "{m}m ago" under an hour, then "{h}h ago". A label later than the clock reads "now",
// so a lock notification never shows a time past the lock clock.
export function ago(clock: string, at: string): string {
  const now = minutes(clock);
  const then = minutes(at);
  if (now === null || then === null) return 'now';
  const gap = now - then;
  if (gap <= 0) return 'now';
  return gap < 60 ? `${gap}m ago` : `${Math.floor(gap / 60)}h ago`;
}

// The latest label among the given ones, so the lock clock is never earlier than its notifications.
export const latest = (labels: readonly string[]): string =>
  labels.reduce((best, label) => ((minutes(label) ?? -1) > (minutes(best) ?? -1) ? label : best), labels[0] ?? '');
