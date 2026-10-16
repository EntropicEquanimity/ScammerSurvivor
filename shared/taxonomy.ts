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
    why: 'Fake reviews, friendly group members, a polished look, a small first payout or sweet talk are there to make you drop your guard.',
  },
  urgency: {
    label: 'Rushing you',
    why: 'A deadline, "today only", an emergency or a threat is there so you act before you can think or ask someone.',
  },
  isolation: {
    label: 'Keeping you alone',
    why: 'Being told to keep it secret, tell no one or move to a private chat cuts you off from the people who would check.',
  },
  escalation: {
    label: 'Asking for more each time',
    why: 'A small payment, then a bigger one, then a fee to unlock it all is how the loss keeps growing.',
  },
  authority: {
    label: 'Posing as official',
    why: 'A sender who claims to be a bank, the police, a boss, a courier or a famous name is counting on you not to question it.',
  },
  payment_substitution: {
    label: 'An unusual way to pay',
    why: 'Crypto, gift cards, a QR code, a personal account or cash in hand cannot be traced or taken back.',
  },
  credential_theft: {
    label: 'Asking for a code or login',
    why: 'Giving a one-time code, password, PIN, card number, ID photo or your screen hands someone your account.',
  },
  platform_migration: {
    label: 'Moving you to another app',
    why: 'Moving you from where it started to a private chat takes you away from the app that could warn you.',
  },
  synthetic_identity: {
    label: 'A made-up identity',
    why: 'Stolen photos, a made-up work history, an AI voice or face, or a "broken camera" hide who is really there.',
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

// The 16 common patterns (spec section 3), in rank order, then five unranked ones. Category per trick is a
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
  // The five the team added on Oct 16, unranked. majorIn names only packs with a primary source
  // (docs/new-scams-for-content-lead.md); wrong_number has none yet.
  { id: 'wrong_number', category: 'B', name: 'Wrong number that turns into a pitch', majorIn: [] },
  { id: 'toll_fine', category: 'F', name: 'Unpaid toll or parking fine', majorIn: ['HK'] },
  { id: 'preorder_deposit', category: 'D', name: 'Pre-order deposit for a sold-out item', majorIn: ['SG', 'HK'] },
  { id: 'sim_swap', category: 'C', name: 'Number moving to a new SIM', majorIn: ['AU'] },
  { id: 'slow_add', category: 'E', name: 'New contact who chats first, asks later', majorIn: ['SG', 'AU', 'JP'] },
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

// What the lesson's title calls each trick, in the player's words: "Scam: a fake buyer". Kept short,
// since the title is the screen's large title.
export const TRICK_TITLES: Record<TrickId, string> = {
  family_trouble: 'a fake family emergency',
  paid_task: 'a fake paid task',
  investment_group: 'a fake trading group',
  digital_arrest: 'a fake police threat',
  code_or_account: 'a code grab',
  parcel_fee: 'a fake parcel fee',
  bank_check: 'a fake bank alert',
  listing_leaver: 'a fake buyer',
  fast_romance: 'a fake romance',
  video_threat: 'a video threat',
  app_in_chat: 'a fake app or file',
  payment_change: 'a fake payment change',
  prize_fee: 'a fake prize',
  loan_threat: 'a fake loan fee',
  overseas_job: 'a fake overseas job',
  refund_payment: 'a fake refund',
  wrong_number: 'a friendly wrong number',
  toll_fine: 'a fake toll fine',
  preorder_deposit: 'a fake pre-order',
  sim_swap: 'a SIM swap',
  slow_add: 'a slow-burn new friend',
};

// The fixed "why it was real" lines, served when the Coach's lines are missing or fail the check.
// Both always hold: the Guard keeps every real twin free of tells and of any code request, and its
// sender ends in different digits from the scam's.
export const REAL_WHY: readonly string[] = [
  'It came from the number you already have for them, not a new one.',
  'Nothing in it rushes you, asks you to keep it quiet or asks for a code.',
];

// Where the pair above is wrong for a trick: a real wrong number or a new acquaintance is a number
// you have never had, so "the number you already have" cannot be what shows it is real.
const REAL_WHY_BY_TRICK: Partial<Record<TrickId, readonly string[]>> = {
  wrong_number: ['They said sorry for the wrong number and left it there.', 'Nothing in it turns to money, an app or a tip.'],
  slow_add: ['The chat stays ordinary: no favour, no tip, no money.', 'You can meet them where you met, with other people around.'],
  toll_fine: ["It names the operator's own site and says to pay in the app you already use.", 'Nothing in it rushes you or asks for card details.'],
  preorder_deposit: ['The seller meets in person or uses the marketplace checkout.', 'Nothing is paid to a personal account before you see the item.'],
  sim_swap: ['It asks for no code and no reply.', 'It says to visit a store or open the official app if it was not you.'],
  // The real sender is a number you never saved, so the phone shows "not in your contact list" on these
  // (server/deal.ts STRANGER_TRICKS); what shows it is real is what it does not ask.
  paid_task: ['It asks for nothing up front: no fee, no deposit, no code.', 'It names a place and a time you can check with the company yourself.'],
  listing_leaver: ['They keep the deal on the marketplace and pay on handover.', 'Nothing in it asks you to move to another app or open a link.'],
  fast_romance: ['It stays a chat: no money, no gift card, no app to install.', 'Nothing in it rushes you or asks you to keep it quiet.'],
  overseas_job: ['It asks for no fee and never for your passport.', 'It points you to the official agency list you can check yourself.'],
};

export const realWhyFor = (trickId?: TrickId): readonly string[] => (trickId && REAL_WHY_BY_TRICK[trickId]) || REAL_WHY;
