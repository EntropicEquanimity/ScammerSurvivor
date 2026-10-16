import test from 'node:test';
import assert from 'node:assert/strict';
import { FALLBACK, PLANS } from './aftermathLines.ts';
import type { Group } from './aftermathLines.ts';
import { SCAM_LINES } from './chatterLines.ts';
import { TYPED_KEYS, TYPED_KINDS, typedLine } from './typedLines.ts';

// The Builder's ruling (Oct 17, Skeptic round 5): a fixed scam-side line stays in character but is
// never a call to action. Pressure, excuses and emotion only. It never names a code, a link or page,
// an amount, an account detail, an app to install, a payment or a transfer, and never tells the
// player to send, pay, open, enter, confirm, verify or claim anything. Twin lines are not covered:
// a real sender's calm line is not scam text. Threats about an account ("will be Suspended") are
// pressure and pass; "account" as a thing to hand over does not appear.
const ACTIONABLE = new RegExp(
  [
    '\\d', '[$€£¥₹₱]', 'https?', 'www', '\\.(?:com|net|top|info|example)\\b',
    '\\bcodes?\\b', '\\botp\\b', '\\bpin\\b', '\\bpasswords?\\b',
    '\\blinks?\\b', '\\bpages?\\b', '\\burl\\b', '\\bsites?\\b', '\\bclick', '\\btap\\b',
    '\\bapps?\\b', '\\binstall', '\\bdownload', '\\bsign (?:up|in)\\b', '\\blog ?in\\b', '\\bjoin\\b',
    '\\bpay', '\\bfees?\\b', '\\bcharges?\\b', '\\bdeposit', '\\btop (?:it )?up\\b', '\\btransfer', '\\bmoney\\b', '\\bcash\\b', '\\bamount',
    '\\bsend\\b', '\\bsent\\b', '\\benter\\b', '\\bconfirm', '\\bverif', '\\bclaim\\b', '\\bsettle',
    '\\bdetails?\\b', '\\baddress\\b', '\\bcard\\b', '\\baccount (?:number|details)\\b', '\\bsignals?\\b', '\\btasks?\\b',
  ].join('|'),
  'i',
);

// The FALLBACK groups whose unpinned scam beats are all the scammer talking. In the others the line
// belongs to the real institution, the person told, or the phone itself.
const scamSpeaks = (group: Group): boolean => {
  const written = PLANS[group].scam.filter((beat) => !beat.pin);
  return written.length > 0 && written.every((beat) => beat.from === 'sender');
};

const aftermathScamLines = (): string[] =>
  (Object.keys(FALLBACK) as Group[]).filter(scamSpeaks).flatMap((group) => Object.values(FALLBACK[group].scam).flat());
const chatterScamLines = (): string[] => Object.values(SCAM_LINES).flatMap((row) => Object.values(row));
const typedScamLines = (): string[] => TYPED_KINDS.flatMap((kind) => TYPED_KEYS.map((key) => typedLine(kind, false, key)));

const offenders = (lines: string[]): string[] => lines.filter((line) => ACTIONABLE.test(line));

test('the rule covers the scam side of every fixed line set', () => {
  assert.ok(aftermathScamLines().length >= 30, 'aftermath');
  assert.ok(chatterScamLines().length >= 140, 'chatter');
  assert.ok(typedScamLines().length >= 80, 'typed');
  assert.ok(ACTIONABLE.test('Kindly confirm the Code sent to you now.'), 'the round 5 line would fail');
  assert.ok(ACTIONABLE.test('just top up a little more'), 'top up');
  assert.equal(ACTIONABLE.test('I really need your help, please hurry'), false, 'pressure alone passes');
});

test('no fixed aftermath scam line is a call to action', () => {
  assert.deepEqual(offenders(aftermathScamLines()), []);
});

test('no fixed chatter scam line is a call to action', () => {
  assert.deepEqual(offenders(chatterScamLines()), []);
});

test('no fixed typed-reply scam line is a call to action', () => {
  assert.deepEqual(offenders(typedScamLines()), []);
});
