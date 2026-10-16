// The real brands no card, chat line or voiced beat may name: the Guard's list and the policy grep's
// list in one place. This file is the one the policy grep skips (scripts/check-policy.sh), because it
// has to hold the banned words. Real hotlines (a scam helpline named in lesson copy) are not brands
// and are not listed. Extended Oct 17 (Skeptic round 5) with the major JAPAC banks, wallets and
// super-apps, so every pack is covered equally.

// Whole words, any case.
export const BRAND_WORDS: readonly string[] = [
  // Global platforms and payment names.
  'google', 'microsoft', 'amazon', 'netflix', 'mastercard', 'dhl', 'fedex', 'interpol',
  'samsung', 'binance', 'coinbase', 'youtube', 'linkedin', 'twitter', 'snapchat', 'spotify', 'uber',
  'facetime', 'skype', 'paypal', 'gmail', 'imessage', 'instagram', 'tiktok', 'alipay',
  // Messaging apps.
  'whatsapp', 'telegram', 'viber', 'wechat', 'facebook', 'zapzap',
  // Singapore.
  'dbs', 'posb', 'ocbc', 'uob', 'paynow', 'grabpay',
  // India.
  'paytm', 'phonepe', 'upi', 'sbi', 'hdfc', 'icici',
  // Japan.
  'paypay', 'rakuten',
  // Indonesia.
  'gopay', 'ovo', 'bca', 'mandiri',
  // Malaysia.
  'maybank', 'cimb',
  // Hong Kong.
  'octopus', 'hsbc', 'payme', 'fps',
  // Australia.
  'commbank', 'anz', 'westpac', 'payid',
  // Philippines.
  'gcash', 'maya', 'paymaya', 'bpi', 'bdo', 'metrobank', 'landbank', 'unionbank', 'shopee', 'lazada', 'pesopay',
];

// Brands that are also everyday English words or first names: matched only in the brand's own capitals,
// so "the line is busy" or a person called Dana still passes.
export const BRAND_CASED: readonly string[] = ['LINE', 'DANA', 'NAB'];

// Brands of more than one word, any case. Apostrophes and spacing vary in real writing.
export const BRAND_PHRASES: readonly RegExp[] = [/\bgoogle\s*pay\b/i, /\bline\s*pay\b/i, /\btouch\s*['’]?\s*n\s*['’]?\s*go\b/i];

const CASED = new RegExp(`\\b(?:${BRAND_CASED.join('|')})\\b`);

export const hasBrand = (text: string): boolean =>
  (text.toLowerCase().match(/[a-z]+/g) ?? []).some((word) => BRAND_WORDS.includes(word)) ||
  CASED.test(text) ||
  BRAND_PHRASES.some((phrase) => phrase.test(text));
