// The combo: consecutive right decisions build a streak, a wrong one resets it. From the third
// right call in a row, that call and every one after it scores double. Pure, so it is tested.
export const X2_FROM = 3;

export const nextStreak = (streak: number, good: boolean): number => (good ? streak + 1 : 0);

export const multiplierFor = (streak: number): number => (streak >= X2_FROM ? 2 : 1);
