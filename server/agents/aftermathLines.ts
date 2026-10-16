// The Aftermath's fixed parts: which beats follow each action, and the fixed lines used when the
// model is off, slow, refuses or fails the check. Code-written, short and generic (AGENTS.md rule 6):
// no number, no link, no real brand. {name} is the sender's display name. Twin lines never say what
// the sender would never ask for (the Guard's twin rule).
import type { AftermathFrom, AftermathKind } from '../../shared/aftermath.ts';
import type { Action } from '../../shared/types.ts';
import type { SenderKind } from './chatterLines.ts';

export type Group = 'ignore' | 'reply' | 'check' | 'pay' | 'code' | 'refuse' | 'link' | 'block' | 'freeze' | 'tell' | 'page';

// Every action has a group, so a new action is a type error here first.
export const ACTION_GROUP: Record<Action, Group> = {
  ignore: 'ignore',
  hang_up: 'ignore',
  reply: 'reply',
  ask_reference: 'reply',
  keep_secret: 'reply',
  verify_known_number: 'check',
  call_back: 'check',
  hang_up_call_official: 'check',
  pay: 'pay',
  send_money: 'pay',
  share_code: 'code',
  read_code: 'code',
  refuse_code: 'refuse',
  open_link: 'link',
  install: 'link',
  block_report: 'block',
  freeze_account: 'freeze',
  tell_someone: 'tell',
};

// A pinned beat's text is code's (the money line, the blocked line); the rest are written.
export type Pin = 'money_sent' | 'signed_in' | 'stopped' | 'blocked' | 'frozen_scam' | 'frozen_real';

export interface Beat {
  kind: AftermathKind;
  from: AftermathFrom;
  pin?: Pin;
  // What the model is asked to write for this beat, in a few words.
  brief?: string;
}

const bubble = (brief: string): Beat => ({ kind: 'bubble', from: 'sender', brief });

export const PLANS: Record<Group, { real: Beat[]; scam: Beat[] }> = {
  ignore: {
    real: [bubble('a minute later the sender follows up, warm and a little puzzled')],
    scam: [bubble('the sender pushes once more, a last chance or final notice, then goes quiet')],
  },
  reply: {
    real: [bubble('a warm, normal answer that fits the message')],
    scam: [bubble('thanks, then the sender asks for one more thing, like a small extra fee or a code')],
  },
  check: {
    real: [{ kind: 'call', from: 'sender', brief: 'the call connects and the sender confirms it was them, warmly' }],
    scam: [{ kind: 'call', from: 'real', brief: 'the real one answers: they never sent that, do not click or pay' }],
  },
  pay: {
    real: [bubble('a short thank you, it arrived')],
    scam: [
      { kind: 'banner', from: 'bank', pin: 'money_sent' },
      bubble('one short line saying it was received and to wait, before they vanish'),
      { kind: 'system', from: 'system', pin: 'stopped' },
    ],
  },
  code: {
    real: [bubble('a short thank you, all done')],
    scam: [
      { kind: 'banner', from: 'bank', pin: 'signed_in' },
      bubble('one short line saying all fixed now, before they vanish'),
      { kind: 'system', from: 'system', pin: 'stopped' },
    ],
  },
  refuse: {
    real: [bubble('a calm, fine, no problem answer')],
    scam: [bubble('the sender pushes once more: it expires soon, just send it')],
  },
  link: {
    real: [bubble('a short thanks for checking, the ordinary next step')],
    scam: [bubble('did it open? the sender asks for the next thing, like a code or a detail')],
  },
  block: {
    real: [{ kind: 'banner', from: 'sender', brief: 'the sender reaches out from another app: a person is surprised you blocked them; a company calmly says it could not reach you and to check its official app' }],
    scam: [{ kind: 'system', from: 'system', pin: 'blocked' }],
  },
  freeze: {
    real: [{ kind: 'banner', from: 'bank', pin: 'frozen_real' }, bubble('the sender follows up, a little puzzled that nothing came')],
    scam: [{ kind: 'banner', from: 'bank', pin: 'frozen_scam' }, bubble('the sender pushes: why is it not going through, try again now')],
  },
  tell: {
    real: [{ kind: 'banner', from: 'trusted', brief: 'the person you told says it looks normal, it is really them' }],
    scam: [{ kind: 'banner', from: 'trusted', brief: 'the person you told says do not send anything, it is a scam' }],
  },
  page: {
    real: [{ kind: 'banner', from: 'sender', brief: 'a short confirmation that it went through' }],
    scam: [{ kind: 'system', from: 'system', brief: 'starts with "Later today," and hints at what someone will try with what was sent' }],
  },
};

// The pinned texts. {amount} is the stake in the pack's currency.
export const PINNED: Record<Pin, string> = {
  money_sent: '{amount} sent to a new payee.',
  signed_in: 'Your account was signed in on a new phone.',
  stopped: '{name} stopped replying.',
  blocked: 'This sender is blocked.',
  frozen_scam: 'Your account is frozen. Nothing can leave it.',
  frozen_real: 'Your card is frozen. You can unfreeze it in the app.',
};

type Lines = Partial<Record<SenderKind, string[]>> & { default: string[] };

// How each sender sounds, so a line reads like a real text (the team's voice note, Oct 16).
// Real people text casually; real companies send terse automated alerts; each scam sounds like real
// ones for its trick. Contractions everywhere except in company templates.
const PEOPLE: ReadonlySet<SenderKind> = new Set(['relative', 'friend', 'boss', 'buyer']);
const REAL_PERSON = 'a real person texting: casual, contractions, short, lowercase is fine, "omw" or "lol" now and then';
const REAL_COMPANY = 'a real company: a terse automated alert, plain and calm, no contractions';
const SCAM_VOICE: Record<SenderKind, string> = {
  relative: 'a fake relative: casual and emotional, contractions, pushy',
  friend: 'a fake friend: casual and upbeat, contractions, a little too eager',
  boss: 'a fake manager: curt and urgent, contractions',
  buyer: 'a fake buyer: broken English, short, overly polite',
  mentor: 'a fake trading coach: over-friendly hype, contractions',
  recruiter: 'a fake recruiter: over-friendly hype, slightly off wording',
  bank: 'a fake bank: a slightly-off corporate template, stiff, odd capitals',
  wallet: 'a fake wallet app: a slightly-off corporate template, stiff, odd capitals',
  courier: 'a fake courier: a slightly-off corporate template, stiff, odd capitals',
  prize_office: 'a fake prize office: a slightly-off corporate template, too excited',
  police: 'a fake official: stiff, formal and threatening',
  unknown: 'a scammer: a slightly-off template, pushy',
};

export function voiceFor(from: AftermathFrom, kind: SenderKind, isTwin: boolean): string {
  if (from === 'trusted') return REAL_PERSON;
  if (from === 'system') return 'the phone itself: plain and short';
  if (from === 'real' || isTwin) return PEOPLE.has(kind) ? REAL_PERSON : REAL_COMPANY;
  return SCAM_VOICE[kind];
}

// One string per unpinned beat, in order, written in the same voices.
export const FALLBACK: Record<Group, { real: Lines; scam: Lines }> = {
  ignore: {
    real: {
      default: ['hey, did u see my message?'],
      boss: ["no worries, I'll ask someone else"],
      buyer: ["ok no worries, I'll ask someone else"],
      courier: ['Delivery attempt pending. We will try again tomorrow.'],
      bank: ['Reminder: your request is waiting in the app.'],
      wallet: ['Reminder: your request is waiting in the app.'],
      recruiter: ['Reminder: please reply when you are free.'],
      police: ['Reminder: please contact the station during office hours.'],
      prize_office: ['Reminder: your entry is still open.'],
    },
    scam: {
      default: ['FINAL NOTICE. Kindly respond Immediately.'],
      relative: ["why aren't u answering?? please I really need u"],
      friend: ["hello?? spot closes tonight, don't miss it!!"],
      mentor: ["Last spots tonight!! Don't miss your profit, dear"],
      recruiter: ['Last call dear, the role goes to other candidate tonight'],
      police: ['FINAL NOTICE. Failure to respond will be recorded against your name.'],
      courier: ['FINAL NOTICE: Your Parcel will be Returned to Sender today.'],
      bank: ['FINAL NOTICE: Your Account will be Suspended today.'],
      wallet: ['FINAL NOTICE: Your Account will be Suspended today.'],
      buyer: ['hello? you there? I pay now, just confirm please'],
      boss: ['need this done now. confirm asap'],
    },
  },
  reply: {
    real: {
      default: ['great, thanks!'],
      relative: ['lovely, talk soon!'],
      friend: ['yay ok see u then!'],
      boss: ['thanks, that helps a lot'],
      buyer: ["great, I'll swing by to pick it up"],
      courier: ['Thank you. Your delivery is on its way.'],
      bank: ['Thank you. Your request is recorded.'],
      wallet: ['Thank you. Your request is recorded.'],
    },
    scam: {
      default: ['Thank you! Just one more small fee and its done.'],
      relative: ["thank u!! can u send it now? I'll explain later"],
      friend: ["omg thanks! just one more small thing and we're set"],
      police: ['Noted. Remain in this chat and inform no one. The case is sealed.'],
      bank: ['Thank You. Kindly confirm the Code sent to you now.'],
      wallet: ['Thank You. Kindly confirm the Code sent to you now.'],
      courier: ['Thank You. Kindly pay the small Handling Fee to release.'],
      mentor: ['amazing!! top up a little more to unlock your profit'],
      recruiter: ['Great dear! First task needs small deposit to start.'],
      buyer: ['ok good. you open my payment page to receive money ok'],
      boss: ['thanks. keep this between us, send it before noon'],
    },
  },
  check: {
    real: {
      default: ["yes it's me! all good, talk soon"],
      relative: ["yes it's me! omw"],
      friend: ["haha yes it's me, see u later!"],
      bank: ['Yes, that message was from us. You can view it in the app.'],
      wallet: ['Yes, that message was from us. You can view it in the app.'],
      courier: ['Yes, that is your parcel. It is out for delivery.'],
    },
    scam: {
      default: ['We did not send that message. Do not click it.'],
      relative: ["what? that wasn't me, my phone's right here"],
      friend: ["wait what, that wasn't me. don't send anything"],
      boss: ["that wasn't me. don't send anything"],
      buyer: ["huh? that wasn't me lol"],
      bank: ['We did not send that message. Do not click it or share any code.'],
      wallet: ['We did not send that message. Do not click it or share any code.'],
      police: ['We do not contact people that way. End the conversation.'],
    },
  },
  pay: {
    real: { default: ['got it, thanks!'], courier: ['Payment received. Thank you.'], bank: ['Payment received. Thank you.'] },
    scam: { default: ['Received. Kindly wait for Confirmation.'], relative: ["got it thank u!! I'll explain later"], buyer: ['ok received. wait'] },
  },
  code: {
    real: { default: ['got it, thanks!'] },
    scam: { default: ['Thank You, all fixed now.'], relative: ['thanks!! all sorted now'], friend: ['thanks!! all sorted now'] },
  },
  refuse: {
    real: { default: ['no worries!'], bank: ['Understood. No action is needed.'], wallet: ['Understood. No action is needed.'] },
    scam: { default: ['Code expire in one minute. Kindly send it Now.'], relative: ['please just send it, it expires soon!!'], friend: ['pls just send it, it expires soon!!'] },
  },
  link: {
    real: { default: ['thanks for checking!'], courier: ['Thank you. Your delivery details are updated.'], bank: ['Thank you. You can view this in the app.'] },
    scam: { default: ['Did it open? Kindly enter the Code we sent.'], relative: ['did it open? just put in the code I sent'], friend: ['did it open? just put in the code I sent'] },
  },
  block: {
    real: {
      default: ['did u block me??'],
      bank: ['We could not reach you. Please check the official app.'],
      wallet: ['We could not reach you. Please check the official app.'],
      courier: ['We could not reach you about your parcel.'],
      recruiter: ['We could not reach you. Please check your email.'],
      police: ['We could not reach you. Please call the station.'],
      prize_office: ['We could not reach you. Please check the official app.'],
    },
    scam: { default: [] },
  },
  freeze: {
    real: { default: ['hey did u see my message?'] },
    scam: { default: ['Transfer Failed. Kindly try again Now.'], relative: ["why isn't it going through?? try again now"], friend: ["why isn't it going through?? try again now"] },
  },
  tell: {
    real: { default: ["looks normal to me, it's really them"] },
    scam: { default: ["don't send anything!! that's a scam, I got one too"] },
  },
  page: {
    real: { default: ['Thank you. That went through.'] },
    scam: { default: ['Later today, someone tries to use what you sent.'] },
  },
};
