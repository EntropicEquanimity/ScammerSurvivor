import { PROFILE, autofillFor } from '../../../../shared/profile.ts';
import type { FieldId } from '../../../../shared/profile.ts';
import type { PageKind } from '../../../../shared/page.ts';

// The practice page's rows, filled only by tapping the autofill suggestion built from the pretend
// profile (AGENTS.md rule 3, the 16 Oct exception). Pure: the form state, what each row and chip
// says, and what a send's reply means. No value the player knows is ever asked for or kept.

// Codes and long numbers show in groups of three, so no run of digits on screen passes four
// (the same grouping as the call's code text, CodeNotice.tsx codeShown).
export const groupDigits = (text: string): string =>
  text.replace(/\d{5,}/g, (run) => run.replace(/(\d{3})(?=\d)/g, '$1 '));

export const ROW_LABEL: Record<FieldId, string> = {
  tracking: 'Tracking number',
  name: 'Full name',
  birthday: 'Date of birth',
  address: 'Address',
  id_photo: 'ID photo',
  password: 'Password',
  code: 'Code',
  card: 'Card number',
};

// What a filled row shows. The password and the card are masked the way a web form masks them.
const ROW_VALUE: Partial<Record<FieldId, string>> = {
  password: '••••••••',
  card: `•••• ${PROFILE.cardEnding}`,
  code: PROFILE.code,
  id_photo: 'ID card photo',
};

export const rowValue = (id: FieldId): string => groupDigits(ROW_VALUE[id] ?? autofillFor(id));

const FROM_MESSAGES = 'From Messages ';

// The QuickType chip: the one-time code reads "From Messages" over the code, as on iOS.
export function chipText(id: FieldId): { main: string; sub?: string } {
  const text = groupDigits(autofillFor(id));
  return text.startsWith(FROM_MESSAGES) ? { sub: FROM_MESSAGES.trim(), main: text.slice(FROM_MESSAGES.length) } : { main: text };
}

// The page's own send button, worded for its kind. The same words on a scam page and a real one.
const SEND_LABEL: Record<PageKind, string> = {
  sign_in: 'Sign in',
  redelivery: 'Book delivery',
  id_check: 'Verify',
  card_confirm: 'Confirm card',
  attachment_gate: 'View file',
  case_portal: 'View case',
  trading_signup: 'Open account',
  video_verify: 'Join video chat',
  task_deposit: 'Start task',
  fine_payment: 'Pay now',
  deposit_checkout: 'Pay deposit',
  tracking: 'Track parcel',
  bank_app_note: 'Continue',
  info_page: 'Continue',
};

export const sendLabel = (kind: PageKind): string => SEND_LABEL[kind];

export interface FormState {
  filled: FieldId[];
  focus: FieldId | null; // the row the autofill bar is offering for
}

export const EMPTY_FORM: FormState = Object.freeze({ filled: [], focus: null }) as FormState;

export const focusRow = (state: FormState, id: FieldId): FormState => ({ ...state, focus: id });

// Fills the focused row and moves on to the next empty one below it, then any empty one above,
// as autofill steps through a form. All filled: the bar goes away.
export function fillFocused(state: FormState, fields: readonly FieldId[]): FormState {
  if (!state.focus) return state;
  const filled = state.filled.includes(state.focus) ? state.filled : [...state.filled, state.focus];
  const at = fields.indexOf(state.focus);
  const order = [...fields.slice(at + 1), ...fields.slice(0, at)];
  return { filled, focus: order.find((id) => !filled.includes(id)) ?? null };
}

// What the send button sends: the filled rows, in the page's order.
export const givenOf = (state: FormState, fields: readonly FieldId[]): FieldId[] => fields.filter((id) => state.filled.includes(id));

export type SendOutcome = 'sent' | 'leave' | 'failed';

// A send that already landed counts as sent (a retry after a lost reply). A card already acted on
// or a card without a page can only go on to the act. Anything else stays on the page to try again.
export function outcomeOf(status: number, error: string | undefined): SendOutcome {
  if (status === 200 || error === 'already_sent') return 'sent';
  return error === 'already_acted' || error === 'no_page' ? 'leave' : 'failed';
}

// The pack codes a host can end in ("northgate-parcels-au.example"): the site writes them in capitals.
// ponytail: "in" is left out, since "sign-in" and "log-in" end hosts too; an India host reads "In".
const COUNTRY_TAIL = ['au', 'hk', 'id', 'jp', 'my', 'ph', 'sg'];

// "harbour-secure.example" reads as "Harbour Secure", the way a site names itself in its header. A
// last word that is a country code after two or more words reads in capitals ("Northgate Parcels AU").
export const siteName = (host: string): string => {
  const words = host.replace(/\.example$/, '').split(/[-.]/).filter(Boolean);
  return words
    .map((word, index) => (index === words.length - 1 && index >= 2 && COUNTRY_TAIL.includes(word) ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1)))
    .join(' ');
};
