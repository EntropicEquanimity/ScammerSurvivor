// Masks a phone number in the country's pattern. In the mask, X hides a digit
// and d keeps one; every other character is copied as written. The kept digits
// are taken from the end of the number, so '09XX XXX dddd' shows the last four.
export function maskNumber(number: string, mask: string): string {
  const digits = number.replace(/\D/g, '').split('');
  const out: string[] = [];
  for (let i = mask.length - 1; i >= 0; i -= 1) {
    const ch = mask[i];
    if (ch === 'd') out.unshift(digits.pop() ?? 'X');
    else out.unshift(ch);
  }
  return out.join('');
}

// The number a play screen shows, in the pack's own local format, dot-masked so no one can dial it
// (the Builder's ruling, Oct 17, Skeptic round 5; it replaces lesson 23's whole invented number).
// d keeps a digit from the end of the number, every other character is copied, at most four digits
// show in all. The card's last digits are kept, so a scam and its twin still differ.
export const LOCAL_FORMAT: Readonly<Record<string, string>> = {
  AU: '04•• ••• •dd',
  HK: '9••• •ddd',
  ID: '08••-••••-••dd',
  IN: '9•••• ••ddd',
  JP: '0•0-••••-••dd',
  MY: '01•-••• ••dd',
  PH: '09•• ••• ••dd',
  SG: '9••• •ddd',
};
const ANY_PACK = '•••• ••dd';
const DOT = '•';

export function localNumber(masked: string, country: string): string {
  const digits = masked.replace(/\D/g, '');
  if (digits.length === 0) return masked;
  const format = LOCAL_FORMAT[country.toUpperCase()] ?? ANY_PACK;
  return maskNumber(digits, format).replace(/X/g, DOT);
}
