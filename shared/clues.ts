// Clues: the things inside a message the player can inspect, picked by the Director from this fixed
// set. Each clue hangs on one part of the card, so tapping it marks that part and scoring stays per
// part. Real twins carry clues too, so a clue on screen never gives the answer away. The browser
// draws each kind from its own component; the model never writes markup.
import { moneyComesIn } from './money.ts';

export const CLUE_KINDS = ['link_preview', 'payment_request', 'countdown', 'badge', 'voice_note', 'parcel_status', 'code_box'] as const;
export type ClueKind = (typeof CLUE_KINDS)[number];

export interface Clue {
  kind: ClueKind;
  partId: string; // the part it sits under; the part's text must ground it
  title: string; // the line the clue shows ("Harbourline secure login", "Parcel held")
  detail: string; // what inspecting reveals ("Opens harbour-login.example", "Added by the sender")
  amount?: number; // payment_request: a figure that appears in the part's text
  minutes?: number; // countdown: 1 to 60
}

export const MAX_CLUES = 2;
const MAX_LINE = 60;

export type ClueReason = 'clue_kind' | 'clue_part' | 'clue_grounding' | 'clue_count' | 'clue_text';

const LINK_HOST = /\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.example)\b/i;
const DIGIT_RUN = /\d{5,}/;
const EM_DASH = String.fromCharCode(0x2014);

const isKind = (kind: unknown): kind is ClueKind => typeof kind === 'string' && (CLUE_KINDS as readonly string[]).includes(kind);

// Why one clue fails against the parts it may sit on, or null when it holds.
export function clueReason(clue: Partial<Clue>, parts: readonly { id: string; text: string }[]): ClueReason | null {
  if (!isKind(clue.kind)) return 'clue_kind';
  const part = parts.find((p) => p.id === clue.partId);
  if (!part) return 'clue_part';
  const lines = [clue.title ?? '', clue.detail ?? ''];
  if (lines.some((line) => line.length === 0 || line.length > MAX_LINE || DIGIT_RUN.test(line) || line.includes(EM_DASH))) return 'clue_text';
  const text = part.text.toLowerCase();
  if (clue.kind === 'link_preview') {
    const host = LINK_HOST.exec(clue.detail ?? '')?.[1]?.toLowerCase();
    if (!host || !text.includes(host)) return 'clue_grounding';
  }
  if (clue.kind === 'payment_request' && (typeof clue.amount !== 'number' || !text.includes(String(clue.amount)))) return 'clue_grounding';
  // A payment request needs a part that asks for money: a friend's share coming in is not one (Angel, Oct 16).
  if (clue.kind === 'payment_request' && moneyComesIn(part.text)) return 'clue_grounding';
  if (clue.kind === 'countdown' && (typeof clue.minutes !== 'number' || clue.minutes < 1 || clue.minutes > 60)) return 'clue_grounding';
  if (clue.kind === 'code_box' && !/\bcode\b/.test(text)) return 'clue_grounding';
  return null;
}

// Every reason across a list of clues, the count rule included. Empty means the list holds.
export function cluesReasons(clues: readonly Partial<Clue>[] | undefined, parts: readonly { id: string; text: string }[]): ClueReason[] {
  if (!clues || clues.length === 0) return [];
  const own = clues.map((clue) => clueReason(clue, parts)).filter((r): r is ClueReason => r !== null);
  return clues.length > MAX_CLUES ? ['clue_count', ...own] : own;
}
