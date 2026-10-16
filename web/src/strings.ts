import type { Lang, People } from '../../shared/types.ts';
import { PEOPLE_ROLES } from '../../shared/types.ts';
import { INSTITUTIONS, isInstitutionId } from '../../shared/brands.ts';
import { PEOPLE_CHIPS } from '../../shared/people.ts';
import { NON_AFFILIATION } from '../../shared/strings.ts';

// No team mailbox: questions go to the public repository, linked from the Privacy page.
export const CONTACT_PAGE = 'github.com/EntropicEquanimity/ScammerSurvivor';

const en = {
  langLabel: 'Language',
  langNames: { en: 'English' },
  firstOpen: {
    title: 'Practise spotting scams',
    notice: 'This is practice only. No real money or accounts here.',
    how: 'A message will arrive on this practice phone. You decide what to do with it. Take your time.',
    ageQuestion: 'This practice is for adults. Are you 18 or older?',
    ageYes: 'Yes, I am 18 or older',
    ageNo: 'No, I am under 18',
    ageBlocked: 'Thank you for telling us. This practice is for people 18 and over.',
  },
  home: {
    title: 'Scammer Survivor',
    now: 'now',
    newBadge: '1 new',
    openHint: 'Tap the message to open it.',
    progress: 'Practice message 1 of 1',
    loading: 'Getting your practice message...',
    loadError: 'The practice message did not load. Please check your connection.',
    retry: 'Try again',
  },
  notices: {
    brand: NON_AFFILIATION,
    ai: 'Some messages here may be written by AI.',
    privacy: 'Privacy notice',
    contact: 'Ask the team on the project page',
  },
  chat: {
    back: 'Back to home',
    ask: 'What will you do?',
    reply: 'Reply',
    ignore: 'Ignore',
    block: 'Block and report',
    verify: 'Call their usual number',
    pickReply: 'Choose a reply',
    otherAction: 'Choose a different action',
    you: 'You',
    sent: 'Sent',
    next: 'Continue',
  },
  flags: {
    title: 'What did you notice?',
    hint: 'Tap anything you noticed in the message. There is no rush.',
    nothing: 'I noticed nothing odd',
    done: 'Done',
    sendError: 'Your answer did not go through. Please try again.',
  },
  debrief: {
    realTrusted: 'Right, that really was family. Not every message is a scam.',
    realDoubted: 'Almost. This one was a real message.',
    realDoubtedNote: 'Being careful is good. Scammers count on us doubting everyone, so trusting real family matters too.',
    scamCaught: 'You caught it. This was a scam.',
    scamMissed: 'Almost. Let us look at it together.',
    scamMissedNote: 'Scammers are this good. Let us look at the signs.',
    again: 'The message again',
    flagsTitle: 'What you noticed',
    noticed: 'noticed',
    lookAt: 'look at this',
    notHere: 'not in this message',
    nothingMarked: 'You marked nothing odd.',
    safeTitle: 'Why it was safe to trust',
    safe: 'No request for money. No rush. No secrets. Nothing asked for a code or a link.',
    ruleTitle: 'Remember',
    rule: 'Not sure it is really family? Call the number you already have for them.',
    official: 'For a bank or e-wallet, use its official app or the number on your card.',
    scoreTitle: 'Your practice score',
    realTrust: 'Real messages trusted',
    scamCatch: 'Scams caught',
    noneYet: 'none yet',
    home: 'Back to home',
  },
  privacy: {
    title: 'Privacy notice',
    lines: [
      'This is a practice game. No message, account or payment here is real.',
      'We never ask for your name, phone number, passwords or codes. There is nowhere to type them.',
      'Your taps go to our server so it can work out your score. It does not save them.',
      'This device remembers your age answer and your country. Your results last for this visit only.',
      'No ads and no trackers.',
    ],
    back: 'Back',
  },
  notes: {
    title: 'Scammer Survivor',
    body: 'Everything inside the phone is a simulation. The apps are made up, and no real message is sent or received.',
    progressTitle: 'Round progress',
  },
  of: (count: number, total: number) => `${count} of ${total}`,
};

export type Strings = typeof en;

export const STRINGS: Record<Lang, Strings> = { en };

// Senders the player has a standing tie to read as "your"; every other role is a stranger, "the".
const YOURS: ReadonlySet<string> = new Set(['relative', 'friend', 'bank', 'boss']);

type Sender = { displayName: string; institutionId?: string };

// Who a real message was really from, in words that fit the sender: "your sister" for a person the
// player picked on the setup screen, "the buyer" or "your bank" for a role, the bare name when the
// sender has neither. Never "your" for a stranger.
export function whoReally(sender: Sender, people: People): string {
  const { displayName, institutionId } = sender;
  const role = PEOPLE_ROLES.find((candidate) => people[candidate] === displayName);
  if (role) return `your ${PEOPLE_CHIPS[role].label.toLowerCase()}`;
  if (isInstitutionId(institutionId)) {
    const label = INSTITUTIONS[institutionId].replace(/^your\s+/i, '').toLowerCase();
    return `${YOURS.has(institutionId) ? 'your' : 'the'} ${label}`;
  }
  return displayName;
}

// The line under a real message the player turned away (the lesson's RealNote).
export const twinLine = (sender: Sender, people: People): string =>
  `That was really ${whoReally(sender, people)}. They did not hear back.`;
