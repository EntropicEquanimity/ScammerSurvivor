interface Props {
  wallet: number;
  people: number;
}

export const money = (amount: number): string => amount.toLocaleString('en');

// Two glass pills. Words, not only numbers: the people pill is how a player learns that
// blocking a real person costs something.
export function StakesBar({ wallet, people }: Props) {
  const peopleLine = people === 1 ? '1 person counts on you' : `${people} people count on you`;
  return (
    <div className="stakes">
      <span className="glass glass-strong stakes-pill">Wallet {money(wallet)}</span>
      <span className="glass glass-strong stakes-pill">{peopleLine}</span>
    </div>
  );
}
