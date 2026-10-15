import type { Action } from '../../../../shared/types.ts';

// The one place a button's words live. Buttons carry words, never only icons.
export const ACTION_LABELS: Record<Action, string> = {
  reply: 'Reply',
  ignore: 'Ignore',
  block_report: 'Block and report',
  verify_known_number: 'Verify by calling the number you already know',
  pay: 'Pay',
  open_link: 'Open the link',
  send_money: 'Send money',
  share_code: 'Share the code',
  install: 'Install',
  keep_secret: 'Keep it secret',
  tell_someone: 'Tell someone you trust',
  freeze_account: 'Freeze the account',
  ask_reference: 'Ask for a reference number',
  call_back: 'I will call you back',
  refuse_code: 'Refuse the code',
  read_code: 'Read the code',
  hang_up: 'Hang up',
  hang_up_call_official: 'Hang up and call the official number',
};
