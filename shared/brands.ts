export interface Brand {
  name: string;
  colour: string;
  glyph: string;
}

// Fictional brands only. Colours are sampled from the icons in web/public/art (Oct 16); re-sample if an icon changes. Every name here is a proposal until the trademark
// check in docs/ux-plan.md is done. The other skins join when their slices do.
export const BRANDS = {
  quillo: { name: 'Quillo', colour: '#fe8520', glyph: 'k' },
  fieldpost: { name: 'Fieldpost', colour: '#1789fc', glyph: 'f' },
  fold: { name: 'Fold', colour: '#1fbfb9', glyph: 'f' },
  relay: { name: 'Relay', colour: '#5758f0', glyph: 'r' },
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
