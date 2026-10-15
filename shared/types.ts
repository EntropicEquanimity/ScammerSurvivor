// The data model from docs/build-plan.md section 5, plus the public and scoring
// shapes the browser and the day routes share. Answer-key fields never leave
// the server: see PublicCard.

export type Lang = 'en';

export type TellId =
  | 'trust_building'
  | 'urgency'
  | 'isolation'
  | 'escalation'
  | 'authority'
  | 'payment_substitution'
  | 'credential_theft'
  | 'platform_migration'
  | 'synthetic_identity';

export type Category = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J';

export type Layout =
  | 'green-chat'
  | 'blue-chat'
  | 'sticker-chat'
  | 'cloud-chat'
  | 'purple-chat'
  | 'sms'
  | 'email'
  | 'wallet'
  | 'call';

export const ACTIONS = [
  'reply',
  'ignore',
  'block_report',
  'verify_known_number',
  'pay',
  'open_link',
  'send_money',
  'share_code',
  'install',
  'keep_secret',
  'tell_someone',
  'freeze_account',
  'ask_reference',
  'call_back',
  'refuse_code',
  'read_code',
  'hang_up',
  'hang_up_call_official',
] as const;
export type Action = (typeof ACTIONS)[number];

// The 16 common patterns from the spec, section 3. The long tail widens this later.
export type TrickId =
  | 'family_trouble'
  | 'paid_task'
  | 'investment_group'
  | 'digital_arrest'
  | 'code_or_account'
  | 'parcel_fee'
  | 'bank_check'
  | 'listing_leaver'
  | 'fast_romance'
  | 'video_threat'
  | 'app_in_chat'
  | 'payment_change'
  | 'prize_fee'
  | 'loan_threat'
  | 'overseas_job'
  | 'refund_payment';

export interface CountryPack {
  code: string; // ISO 3166 alpha-2
  layouts: Layout[]; // the three apps scams arrive on, in order
  confidence: 'high' | 'medium' | 'low'; // shown as "from police statistics" or "based on usage"
  deckOrder: TrickId[]; // from the catalogue line; unlisted tricks dealt less often
  hotline: { label: string; number: string; reportUrl: string };
  hotlineVerified: boolean; // false until the Content lead confirms the hotline
  numberMask: string; // e.g. '+65 XXXX dddd'; X hides a digit, d keeps one
  currency: string; // ISO 4217, for the stakes bar
  walletStart: number; // the wallet a day starts with, in that currency
  sources: { title: string; url: string; date: string }[];
}

export interface Trick {
  id: TrickId;
  category: Category;
  name: string;
  commonRank?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;
  catalogueEntry: number;
  majorIn: string[];
  newSince?: string;
  sourceUrl: string;
}

// What the Scout writes and a person approves; the shape scenario-author drafts.
export interface PatternNote {
  id: string;
  country: string;
  category: Category;
  catalogueEntry: number;
  app: Layout;
  setup: string;
  ask: string;
  tells: TellId[];
  safeReplies: Action[];
  unsafeReplies: Action[];
  usualEnding: string;
  realTwin: string;
  confidence: 'high' | 'medium' | 'low';
  source: { url: string; date: string };
  approved: boolean;
}

export interface MessagePart {
  id: string;
  text: string;
  tellIds: TellId[]; // empty on real twins
}

export interface Card {
  id: string;
  trickId: TrickId;
  country: string;
  layout: Layout;
  difficulty: 1 | 2 | 3;
  setup: MessagePart[]; // up to two sentences, may be empty
  ask: MessagePart[]; // the decisive message
  sender: { displayName: string; institutionId?: string; maskedNumber: string };
  safeReplies: Action[];
  unsafeReplies: Action[];
  usualEnding: string; // shown in the lesson
  neverAsks: string; // "A courier never asks for ..." line, shown in the lesson
  stake: number; // wallet amount at risk, in the pack's currency
  plantedTells: TellId[]; // union of ask part tells; answer key, server only
  realTwin: { sender: Card['sender']; parts: MessagePart[]; acceptable: Action[] };
  callBeats?: { tellId: TellId; instruction: string; fallbackLine: string }[];
  language: 'en';
  approved: boolean;
}

export interface Translation {
  cardId: string;
  language: string;
  parts: Record<string, string>;
  guardPassed: boolean;
  reviewed: boolean;
  flags: number; // count of "this reads wrong" taps
}

export interface Day {
  id: string;
  playerId: string;
  country: string;
  language: string;
  quick: boolean;
  cards: { cardId: string; action: Action; tappedTells: TellId[]; realTwinAction: Action }[];
  call?: { cardId: string; beatsDelivered: number; meterEnd: number; action: Action };
  wallet: number;
  peopleKept: number;
  scores: DayScore;
  playedAt: string; // kept 30 days
}

export interface Progress {
  playerId: string;
  level: 1 | 2 | 3;
  collected: { trickId: TrickId; category: Category }[];
  missedTells: Partial<Record<TellId, number>>;
  signedIn: boolean; // until "Delete my data"
}

export type AgeGroup = 'adult' | 'younger';

// "Make it your phone": the people in the player's life, picked from chips, never typed.
// Names come from the chip lists in shared/people.ts; the Director's allowed-names list
// and the real twins are built from these.
export const PEOPLE_ROLES = ['mom', 'dad', 'brother', 'sister', 'best_friend', 'boss', 'landlord'] as const;
export type PeopleRole = (typeof PEOPLE_ROLES)[number];
export type People = Partial<Record<PeopleRole, string>>;

// One agent step as the trace drawer shows it: ids, verdicts and numbers only, never text.
export interface TraceEvent {
  agent: 'director' | 'guard' | 'coach' | 'caller';
  model?: string;
  ms: number;
  tokens?: { input: number; output: number };
  outcome: 'ok' | 'repaired' | 'rejected' | 'fallback' | 'cache';
  reasons?: string[]; // guard rule ids that failed
}

// The standard four buttons every card shows, in this order.
export const STANDARD_ACTIONS: readonly Action[] = ['reply', 'ignore', 'block_report', 'verify_known_number'];

// What the browser sees. No answer key: no plantedTells, safeReplies, unsafeReplies,
// usualEnding, callBeats, realTwin. A dealt slot is either a scam card or its real
// twin; the browser cannot tell which.
export interface PublicCard {
  slotId: string; // unique within the day
  layout: Layout;
  sender: { displayName: string; institutionId?: string; maskedNumber: string };
  setup: { id: string; text: string }[];
  ask: { id: string; text: string }[];
  offered: Action[]; // STANDARD_ACTIONS plus the extras this message offers (same on a scam and its twin)
  stake: number; // wallet amount at risk, shown in the stakes bar
  arrivesAt: string; // day clock label such as '08:10', decorative
  bannerHint?: 'likely_scam' | null; // a system banner like the ones phones show; a hint, sometimes wrong, never proof
}

// The practice call. Beats are written by the Director at build time, voiced by TTS,
// stored outside the repo (Firestore metadata, audio in Cloud Storage). The model
// picks the next beat from the player's action; code moves the meter.
export interface CallBeatPublic {
  id: string;
  role: 'open' | 'pushback' | 'code' | 'close';
  caption: string; // what the caller says, shown as a caption
  audioUrl: string | null; // null when audio is missing; the caption still plays
}

export interface CallStartResult {
  callId: string;
  beat: CallBeatPublic;
  meter: number; // 0 to 100, pressure on the player; starts at 50
  offered: Action[]; // six buttons
}

export interface CallTurnBody {
  action: Action;
}

export interface CallTurnResult {
  beat: CallBeatPublic | null; // null when the call ended
  meter: number;
  meterDelta: number;
  ended: boolean;
  outcome?: 'hung_up' | 'read_code' | 'timeout'; // set when ended
}

// Recovery after a slip: only after an unsafe action on a scam slot, inside a short window.
export interface RecoverBody {
  slotId: string;
  action: Action; // freeze_account | hang_up_call_official | block_report
}

export interface RecoverResult {
  slotId: string;
  recovered: number; // wallet amount clawed back, in the pack's currency
  walletAfter: number;
  windowSeconds: number; // how long the player had
  tooLate: boolean;
}

export interface DayPayload {
  dayId: string;
  country: string;
  quick: boolean;
  wallet: number; // starting wallet
  people: number; // starting people count
  pack: { layouts: Layout[]; confidence: CountryPack['confidence']; hotline: CountryPack['hotline'] };
  cards: PublicCard[]; // 4 for a full day, 2 for a quick day
}

export interface ActBody {
  slotId: string;
  action: Action;
}

export interface TapBody {
  slotId: string;
  tappedPartIds: string[]; // parts of setup and ask the player tapped
}

// Returned after the taps, never after the action alone.
export interface SlotResult {
  slotId: string;
  isScam: boolean;
  actionCorrect: boolean;
  falseAlarm: boolean; // real twin met with block_report or ignore
  caught: TellId[];
  missed: TellId[];
  falseTaps: string[]; // part ids with no tell
  walletAfter: number;
  peopleAfter: number;
  recovered?: number; // set by a recovery action after a slip
  followUp?: { sender: string; text: string } | null; // the wronged person's later message, deterministic, no model
  lesson: {
    tells: { id: TellId; label: string; why: string }[]; // from shared/taxonomy.ts
    neverAsks: string; // "A courier never asks for ..." style line
    usualEnding: string;
    scam: { sender: PublicCard['sender']; parts: { id: string; text: string; tellIds: TellId[] }[] };
    real: { sender: PublicCard['sender']; parts: { id: string; text: string }[] };
    hotline: CountryPack['hotline'];
  };
}

// A rate kept as a fraction: players see "2 of 3", never a percentage.
export interface Tally {
  handled: number;
  total: number;
}

export interface DayScore {
  scamsCaught: Tally;
  realTrusted: Tally;
  wallet: number;
  walletStart: number;
  people: number;
  peopleStart: number;
  tellMostMissed: TellId | null;
  collected: { trickId: TrickId; category: Category }[];
}
