// The pack's currency (content/packs/*.json "currency") for the lock's wallet widget. The day's public
// pack does not carry it, so the eight codes live here; currency.test.ts keeps them equal to the packs.
export const CURRENCIES: Readonly<Record<string, string>> = {
  AU: 'AUD', HK: 'HKD', ID: 'IDR', IN: 'INR', JP: 'JPY', MY: 'MYR', PH: 'PHP', SG: 'SGD',
};

export const currencyFor = (country: string | null): string => (country && CURRENCIES[country]) || '';
