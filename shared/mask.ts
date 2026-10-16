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

// The header number in the pack's own local mobile format: a plausible invented number, never an
// X-mask (lesson 23). The card's last four digits are kept, so a scam and its twin still differ; the
// digits before them are invented from those four, so every sender does not share one prefix.
// d keeps a digit from the end of the masked number, m is an invented digit, the rest is copied.
export const LOCAL_FORMAT: Readonly<Record<string, string>> = {
  AU: '04mm mmd ddd',
  HK: '9mmm dddd',
  ID: '08mm-mmmm-dddd',
  IN: '9mmmm mdddd',
  JP: '090-mmmm-dddd',
  MY: '01m-mmm dddd',
  PH: '09mm mmm dddd',
  SG: '9mmm dddd',
};

const invented = (kept: string[], index: number): string => String((Number(kept[index % kept.length] ?? 0) * 3 + index + 1) % 10);

export function localNumber(masked: string, country: string): string {
  const format = LOCAL_FORMAT[country.toUpperCase()];
  const kept = masked.replace(/\D/g, '').slice(-4).split('');
  if (!format || kept.length < 4 || !/X/.test(masked)) return masked;
  let m = 0;
  const shown = maskNumber(kept.join(''), format.replace(/m/g, 'M'));
  return shown.replace(/M/g, () => invented(kept, m++));
}
