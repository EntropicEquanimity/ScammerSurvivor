// The pack's currency (content/packs/*.json "currency") for the lock's wallet widget. The day's public
// pack does not carry it, so the eight codes live here; currency.test.ts keeps them equal to the packs.
export const CURRENCIES: Readonly<Record<string, string>> = {
  AU: 'AUD', HK: 'HKD', ID: 'IDR', IN: 'INR', JP: 'JPY', MY: 'MYR', PH: 'PHP', SG: 'SGD',
};

export const currencyFor = (country: string | null): string => (country && CURRENCIES[country]) || '';

// "SGD 500": the code and the figure, the way the cards write money (recovery, the clue's payment
// request). No pack, the figure alone. Same figure format as StakesBar's money().
export const moneyIn = (amount: number, country: string | null): string => {
  const figure = amount.toLocaleString('en');
  const code = currencyFor(country);
  return code ? `${code} ${figure}` : figure;
};
