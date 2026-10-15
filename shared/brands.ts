export interface Brand {
  name: string;
  colour: string;
  glyph: string;
}

// Fictional brands only. Every name here is a proposal until the trademark
// check in docs/ux-plan.md is done. The other skins join when their slices do.
export const BRANDS = {
  kwentuhan: { name: 'Kwentuhan', colour: '#CB4936', glyph: 'k' },
  fieldpost: { name: 'Fieldpost', colour: '#C03570', glyph: 'f' },
  fold: { name: 'Fold', colour: '#087A89', glyph: 'f' },
  relay: { name: 'Relay', colour: '#A0522D', glyph: 'r' },
} satisfies Record<string, Brand>;

export type BrandId = keyof typeof BRANDS;

// Senders by role, never a real organisation. Cards point at these through
// sender.institutionId; the display name comes from here, never free text.
export const INSTITUTIONS = {
  relative: 'Family member',
  friend: 'Friend',
  courier: 'Courier',
  bank: 'Your bank',
  wallet: 'Wallet app',
  police: 'Police',
  recruiter: 'Hiring team',
  mentor: 'Trading group',
  prize_office: 'Prize office',
  buyer: 'Buyer',
  boss: 'Manager',
} satisfies Record<string, string>;

export type InstitutionId = keyof typeof INSTITUTIONS;

export const isInstitutionId = (id: unknown): id is InstitutionId =>
  typeof id === 'string' && Object.hasOwn(INSTITUTIONS, id);
