// The fixed lines for a typed reply: one per kind of sender and what the player's words were (the
// intent), for a scam and for its real twin, plus a line for nonsense sent again. Used when the model
// is off, slow, blocked or fails its checks, and for abuse, which never reaches the model.
// Code-written, short and generic (AGENTS.md rule 6): no amount, no link, no number, no real brand.
// {name} is the sender's display name. Voices follow docs/game-design.md, "Voice".
import type { TypedIntent, TypedTactic } from '../../shared/types.ts';
import type { SenderKind } from './chatterLines.ts';

export type TypedKey = TypedIntent | 'again';
type Row = [question: string, refuse: string, agree: string, nonsense: string, offtopic: string, abuse: string, again: string];
const KEYS: readonly TypedKey[] = ['question', 'refuse', 'agree', 'nonsense', 'offtopic', 'abuse', 'again'];

const SCAM_ROWS: Record<SenderKind, Row> = {
  relative: ["can't explain it all now, pls just help me today", 'pls!! I have no one else to ask', 'thank u!! I will send what to do next, be quick pls', 'what?? pls focus, I need help now', "not now!! pls I'm stuck and it's urgent", "ok forget it. I'll find someone else", "why aren't u helping?? I'll ask someone else then"],
  friend: ["it's a long story, I'll explain later. can you help today?", "wow, I thought we were close. it's only a small favour", "you're the best. I'll walk you through it now", "haha what? anyway, can you help me today?", "lol later. first can you help me out today?", "ok, never mind then", "are you even reading this? fine, forget it"],
  bank: ['Kindly Note this is an Urgent Security matter. Act today to avoid Restriction.', 'Failure to act will result in Account Restriction today.', 'Thank You. Kindly follow the next step sent in this chat.', 'Message not understood. Kindly respond to the Security Notice.', 'Kindly respond only regarding your Account Security.', 'This chat is for Account matters only.', 'Final Notice. Your Account will be Restricted.'],
  wallet: ['Kindly Note this is an Urgent Wallet Review. Act today to keep access.', 'Failure to verify will Suspend your Wallet today.', 'Thank You. Kindly follow the next step in this chat.', 'Message not understood. Kindly respond to the Wallet Notice.', 'Kindly respond only regarding your Wallet.', 'This chat is for Wallet matters only.', 'Final Notice. Your Wallet will be Suspended.'],
  courier: ['Kindly settle today or the Parcel will be Returned.', 'Unpaid Parcel will be Returned to sender today.', 'Thank You. Kindly complete the step in this chat.', 'Message not understood. Kindly respond about your Parcel.', 'Kindly respond only about your Parcel on Hold.', 'This chat is for Delivery matters only.', 'Final Notice. Parcel will be Returned today.'],
  police: ['This matter is serious. You are required to cooperate today.', 'Refusal to cooperate will be recorded as obstruction.', 'Good. Remain in this chat and follow the instructions given.', 'Your reply is not understood. Respond to the case immediately.', 'Irrelevant. Respond only regarding the case against you.', 'This conduct has been noted. The case will proceed.', 'Final warning. Failure to respond will escalate this case.'],
  recruiter: ['Great question dear! Slots fill fast so start today!', 'Are you sure? Many people would love this chance!', 'Wonderful! I will send your first easy task now!', 'Sorry dear, I did not get that! Shall we start today?', "Haha! Let's focus on your new income first!", 'Okay, this chat is closed.', 'Seems you are not serious. Offer withdrawn!'],
  mentor: ["Good question. My students who acted today are already up. Don't wait.", "Your loss. My students trust the signals and it shows.", "Smart move. I'll send today's signal and the next step.", "Not sure what you mean. Today's signal won't wait though.", "Let's stick to the trade. Today's window closes soon.", 'I only work with serious students.', "I can't teach someone who isn't listening. Last chance today."],
  prize_office: ['Kindly Note your Prize must be Claimed today.', 'Unclaimed Prizes are Forfeited today.', 'Congratulations. Kindly follow the Claim step in this chat.', 'Message not understood. Kindly respond about your Prize.', 'Kindly respond only about your Selected Prize.', 'This chat is for Prize claims only.', 'Final Notice. Your Prize will be Forfeited.'],
  buyer: ['I am genuine buyer, pls do it today and I take the item', 'pls, I already arrange everything. just do it today', 'ok thank you. I send next step now, pls check', 'sorry I not understand. you sell item or not?', 'pls, only about the item. I want buy today', 'ok, no deal', 'you not serious seller. I find other'],
  boss: ['need this done today, no time to explain', "I don't have time for this. just get it done", "good. I'll send what's needed next", "what? focus please, it's urgent", 'not now. this first, today', 'noted. we will talk about this later', "I'll find someone who can actually help"],
  unknown: ["it's important, please sort it out today", "please, it won't take long", "thanks. I'll send the next step now", "sorry, I didn't get that. can you help today?", "let's get back to it, it's urgent", 'ok, goodbye', "fine, I'll ask someone else"],
};

const TWIN_ROWS: Record<SenderKind, Row> = {
  relative: ["haha good question, I'll tell u when I see u", "ok no worries, talk later", "great, see u soon", "lol what? did u mean to send that?", "haha random. anyway talk later", "hey, not cool. talk later", "u ok? ring me when ur free"],
  friend: ["good question, I'll explain when we catch up", "no worries at all", "nice, see you then", "lol what? did you mean to send that?", "haha ok random. catch you later", "whoa, ok. talk later", "you ok? ring me when you're free"],
  bank: ['Thank you. You can check this in the official app.', 'Noted. No action is needed.', 'Thank you. No further action is needed.', 'Reply not recognised. Check the official app for details.', 'This number sends account updates only.', 'This number sends account updates only.', 'Reply not recognised. Check the official app for details.'],
  wallet: ['Thank you. You can check this in the official app.', 'Noted. No action is needed.', 'Thank you. No further action is needed.', 'Reply not recognised. Check the official app for details.', 'This number sends wallet updates only.', 'This number sends wallet updates only.', 'Reply not recognised. Check the official app for details.'],
  courier: ['Thank you. Track your delivery in the official app.', 'Noted. Your delivery continues as planned.', 'Thank you. Your delivery is on its way.', 'Reply not recognised. Track your delivery in the official app.', 'This number sends delivery updates only.', 'This number sends delivery updates only.', 'Reply not recognised. Track your delivery in the official app.'],
  police: ['Thank you. Details are on the official community page.', 'Noted. This notice is for your information only.', 'Thank you for reading.', 'Reply not recognised. This is a community notice.', 'This number sends community notices only.', 'This number sends community notices only.', 'Reply not recognised. This is a community notice.'],
  recruiter: ["Good question, happy to go through it when we talk.", "No problem, thanks for letting me know.", "Great, I'll see you at the interview.", "Sorry, I didn't follow that. Did you mean to send it?", "Ha, let's keep it to the role for now.", "Let's keep this professional, thanks.", "Sorry, still not sure what you mean. Call the office if easier."],
  mentor: ["Good question, bring it to the next meetup.", "No worries, come along whenever suits.", "Great, see you at the meetup.", "Sorry, not sure what you meant there.", "Ha, let's save that for the meetup.", "Let's keep the group friendly, thanks.", "Still not sure what you mean. See you at the meetup."],
  prize_office: ['Thank you. Details are in the official app.', 'Noted. No action is needed.', 'Thank you. Enjoy your reward.', 'Reply not recognised. Check the official app.', 'This number sends reward notices only.', 'This number sends reward notices only.', 'Reply not recognised. Check the official app.'],
  buyer: ['good question, I can ask when I pick it up', 'no problem, thanks anyway', 'great, see you at pickup', 'sorry, what do you mean?', 'haha ok. still keen on the item', 'ok, no thanks', 'sorry still not sure what you mean'],
  boss: ["good question, let's go over it tomorrow", 'ok, no problem', "great, thanks", 'not sure what you meant there', "ha. let's talk tomorrow", "let's keep it professional", 'still lost. catch me tomorrow'],
  unknown: ["good question, I'll explain later", 'ok, no worries', 'great, thanks', 'sorry, what do you mean?', 'haha ok. talk later', 'ok, bye', 'sorry, still not sure what you mean'],
};

const asRecord = (row: Row): Record<TypedKey, string> =>
  Object.fromEntries(KEYS.map((key, index) => [key, row[index]])) as Record<TypedKey, string>;

const SCAM: Record<SenderKind, Record<TypedKey, string>> = Object.fromEntries(Object.entries(SCAM_ROWS).map(([kind, row]) => [kind, asRecord(row)])) as Record<SenderKind, Record<TypedKey, string>>;
const TWIN: Record<SenderKind, Record<TypedKey, string>> = Object.fromEntries(Object.entries(TWIN_ROWS).map(([kind, row]) => [kind, asRecord(row)])) as Record<SenderKind, Record<TypedKey, string>>;

// The pressure move each fixed scam line makes, so the lesson line holds for a fallback too.
const SCAM_TACTIC: Record<TypedKey, TypedTactic> = { question: 'urgency', refuse: 'guilt', agree: 'urgency', nonsense: 'urgency', offtopic: 'urgency', abuse: 'none', again: 'guilt' };

export const typedLine = (kind: SenderKind, isTwin: boolean, key: TypedKey): string => (isTwin ? TWIN : SCAM)[kind][key];
export const typedLineTactic = (isTwin: boolean, key: TypedKey): TypedTactic => (isTwin ? 'none' : SCAM_TACTIC[key]);
export const TYPED_KINDS = Object.keys(SCAM_ROWS) as SenderKind[];
export { KEYS as TYPED_KEYS };
