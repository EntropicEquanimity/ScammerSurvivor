import type { Category, TellId, Trick, TrickId } from './types.ts';

export interface TellInfo {
  label: string;
  why: string;
}

// The nine tells are the whole taxonomy (spec section 3). They describe a
// pattern and are never message text.
export const TELLS: Record<TellId, TellInfo> = {
  trust_building: {
    label: 'Building trust first',
    why: 'Fake testimonials, group members, professional branding, a small first payout or affection are there to make you lower your guard.',
  },
  urgency: {
    label: 'Rushing you',
    why: 'A deadline, "today", an expiring parcel or points, an emergency or a threat leaves no time to think or ask someone.',
  },
  isolation: {
    label: 'Keeping you alone',
    why: 'Asking you to keep it secret, not tell family or colleagues, or move to a private chat cuts you off from the people who would check.',
  },
  escalation: {
    label: 'Asking for more each time',
    why: 'A small payment, then a bigger one, then an unlock, tax, verification or recovery fee is how the loss grows.',
  },
  authority: {
    label: 'Borrowed authority',
    why: 'A bank, police, government, CEO, celebrity, school, courier or regulator as the sender is meant to stop you questioning it.',
  },
  payment_substitution: {
    label: 'An unusual way to pay',
    why: 'Crypto, gift cards, QR codes, a personal account or a cash handover cannot be traced or reversed.',
  },
  credential_theft: {
    label: 'Asking for a code or login',
    why: 'A request for a one-time code, password, PIN, card number, login, recovery code, ID copy or screen share hands over your account.',
  },
  platform_migration: {
    label: 'Moving you to another app',
    why: 'Something that started on social media, a dating app, a job portal or a text message and moved to a private chat is leaving the place that could flag it.',
  },
  synthetic_identity: {
    label: 'A made-up identity',
    why: 'Stolen photos, a made-up employment history, an AI voice or face, or "camera broken" hide who is really there.',
  },
};

export const TELL_IDS: TellId[] = Object.keys(TELLS) as TellId[];

export const isTellId = (id: unknown): id is TellId =>
  typeof id === 'string' && Object.hasOwn(TELLS, id);

// The ten categories of the expanded catalogue; the collection screen uses them.
export const CATEGORIES: Record<Category, string> = {
  A: 'Employment, task and income',
  B: 'Investment and financial growth',
  C: 'Phishing, account takeover and identity theft',
  D: 'Delivery, shopping and payment',
  E: 'Romance, social and exploitation',
  F: 'Government, institutional and authority impersonation',
  G: 'Travel, education and event',
  H: 'Charity, crisis and unexpected money',
  I: 'Business and organisational fraud',
  J: 'Data harvesting and device compromise',
};

export const CATEGORY_IDS: Category[] = Object.keys(CATEGORIES) as Category[];

export const isCategory = (id: unknown): id is Category =>
  typeof id === 'string' && Object.hasOwn(CATEGORIES, id);

type TrickRow = Pick<Trick, 'id' | 'category' | 'name' | 'commonRank' | 'majorIn'>;

// The 16 common patterns (spec section 3), in rank order. Category per trick is a
// draft for the Content lead; catalogue entry numbers and source links join when
// the catalogue is matched.
export const TRICKS: readonly TrickRow[] = [
  { id: 'family_trouble', category: 'E', name: 'Friend or family in trouble', commonRank: 1, majorIn: ['SG', 'IN', 'AU', 'HK', 'ID', 'PH'] },
  { id: 'paid_task', category: 'A', name: 'Paid-task job', commonRank: 2, majorIn: ['SG', 'MY', 'ID', 'PH', 'IN', 'HK', 'AU'] },
  { id: 'investment_group', category: 'B', name: 'Investment mentor or trading group', commonRank: 3, majorIn: ['SG', 'HK', 'MY', 'AU', 'IN'] },
  { id: 'digital_arrest', category: 'F', name: 'Police, court, or digital arrest', commonRank: 4, majorIn: ['IN', 'SG', 'MY', 'HK'] },
  { id: 'code_or_account', category: 'C', name: 'Code, QR, or rented account', commonRank: 5, majorIn: ['IN', 'ID', 'MY', 'PH', 'SG'] },
  { id: 'parcel_fee', category: 'D', name: 'Parcel fee or address problem', commonRank: 6, majorIn: ['ID', 'MY', 'IN', 'PH', 'SG', 'AU'] },
  { id: 'bank_check', category: 'C', name: 'Bank, KYC, or wallet check', commonRank: 7, majorIn: ['IN', 'ID', 'PH', 'BD', 'LK', 'SG'] },
  { id: 'listing_leaver', category: 'D', name: 'Buyer or seller who leaves the listing', commonRank: 8, majorIn: ['PH', 'MY', 'ID', 'IN', 'AU', 'HK'] },
  { id: 'fast_romance', category: 'E', name: 'Fast romance, then a bill', commonRank: 9, majorIn: ['AU', 'MY', 'PH', 'IN'] },
  { id: 'video_threat', category: 'E', name: 'Video, then a threat', commonRank: 10, majorIn: ['IN', 'PH', 'MY', 'ID', 'AU'] },
  { id: 'app_in_chat', category: 'J', name: 'App or document in the chat', commonRank: 11, majorIn: ['IN', 'ID', 'SG'] },
  { id: 'payment_change', category: 'I', name: 'Boss or supplier changes the payment', commonRank: 12, majorIn: ['SG', 'HK', 'AU', 'MY'] },
  { id: 'prize_fee', category: 'H', name: 'Prize that needs a fee', commonRank: 13, majorIn: ['IN', 'PH', 'BD', 'LK', 'NP', 'ID'] },
  { id: 'loan_threat', category: 'B', name: 'Loan fee or debt threat', commonRank: 14, majorIn: ['ID', 'PH', 'IN', 'SG'] },
  { id: 'overseas_job', category: 'A', name: 'Overseas job that takes the passport', commonRank: 15, majorIn: ['PH', 'ID', 'IN', 'NP', 'BD', 'MM'] },
  { id: 'refund_payment', category: 'D', name: 'Refund that is actually a payment', commonRank: 16, majorIn: ['IN', 'SG', 'MY'] },
];

export const TRICK_IDS: TrickId[] = TRICKS.map((trick) => trick.id);

export const isTrickId = (id: unknown): id is TrickId =>
  typeof id === 'string' && TRICK_IDS.includes(id as TrickId);

export const trickCategory = (id: TrickId): Category =>
  TRICKS.find((trick) => trick.id === id)?.category ?? 'J';

// The deck order for a country: tricks major there first, then the rest, both in rank order.
export const deckOrderFor = (country: string): TrickId[] => [
  ...TRICKS.filter((trick) => trick.majorIn.includes(country)).map((trick) => trick.id),
  ...TRICKS.filter((trick) => !trick.majorIn.includes(country)).map((trick) => trick.id),
];
