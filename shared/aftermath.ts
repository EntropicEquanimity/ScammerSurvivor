// Aftermaths: after a slot is scored, what happened next on the phone, shown before the lesson.
// One to three short items. The kinds and who each one is from are fixed by code per action; the
// text is the Aftermath agent's (server/agents/aftermath.ts) or a fixed line. No answer key here.
export type AftermathKind = 'bubble' | 'banner' | 'call' | 'system';

// sender: the one who sent the message; real: the genuine sender (the call to check a scam);
// bank: the player's own bank; trusted: someone the player told; system: the phone itself.
export type AftermathFrom = 'sender' | 'real' | 'bank' | 'trusted' | 'system';

export interface AftermathItem {
  kind: AftermathKind;
  from: AftermathFrom;
  name: string; // the name on a banner, call or bubble; empty on a system line
  text: string;
}

export interface AftermathResult {
  items: AftermathItem[];
}
