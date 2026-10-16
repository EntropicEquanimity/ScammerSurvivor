import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

// One overlay at a time over whatever screen is open: the in-app browser today, later the inbox and
// the bank alert. Opened through this module, not through the day state machine, so a feature can
// cover the card without touching useDay.ts. PhoneShell renders the open one above the screen and
// under the call layer and the status bar.

export interface Overlay {
  id: string;
  node: ReactNode;
}

let current: Overlay | null = null;
const listeners = new Set<() => void>();

const emit = (): void => listeners.forEach((listener) => listener());

// False when another overlay is already open: the caller keeps its own screen as it was.
export function showOverlay(overlay: Overlay): boolean {
  if (current) return false;
  current = { ...overlay };
  emit();
  return true;
}

// With an id, closes only that overlay, so a late close from an old screen never shuts a newer one.
export function closeOverlay(id?: string): void {
  if (!current || (id !== undefined && current.id !== id)) return;
  current = null;
  emit();
}

export const currentOverlay = (): Overlay | null => current;

export function subscribeOverlay(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const useOverlay = (): Overlay | null => useSyncExternalStore(subscribeOverlay, currentOverlay);
