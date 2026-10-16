import type { Action } from '../../../../shared/types.ts';

// The one place a button's words live. Buttons carry words, never only icons.
// One short line each: a label that wraps in a 2-column grid or under a 72 px call disc is too long.
export const ACTION_LABELS: Record<Action, string> = {
  reply: 'Reply',
  ignore: 'Ignore',
  block_report: 'Block and report',
  verify_known_number: 'Call to check',
  pay: 'Pay',
  open_link: 'Open link',
  send_money: 'Send money',
  share_code: 'Share code',
  install: 'Install',
  keep_secret: 'Keep it secret',
  tell_someone: 'Tell someone',
  freeze_account: 'Freeze account',
  ask_reference: 'Ask for ID',
  call_back: 'Call back',
  refuse_code: 'Refuse code',
  read_code: 'Read the code',
  hang_up: 'Hang up',
  hang_up_call_official: 'Call official',
};
