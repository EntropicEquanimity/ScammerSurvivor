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
