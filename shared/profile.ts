// The pretend player on every practice phone (AGENTS.md rule 3, the 16 Oct exception). Practice
// pages show rows for these fields; a row fills only by tapping the autofill suggestion built from
// these values. Nothing the player knows is asked for, entered or stored. All invented, the same
// for every player. The server keeps field ids only, never these values.
// The call shares the code: the code text that arrives mid-call shows PROFILE.code.

export const FIELD_IDS = ['tracking', 'name', 'birthday', 'address', 'id_photo', 'password', 'code', 'card'] as const;
export type FieldId = (typeof FIELD_IDS)[number];

export const isFieldId = (value: unknown): value is FieldId =>
  typeof value === 'string' && (FIELD_IDS as readonly string[]).includes(value);

export interface PretendProfile {
  name: string;
  birthday: string;
  address: string;
  cardEnding: string; // last four only; the full number is never written anywhere
  code: string; // the one-time code that arrives in Messages, six digits
  tracking: string; // the parcel the player is really waiting for
}

export const PROFILE: Readonly<PretendProfile> = Object.freeze({
  name: 'Jordan Lee',
  birthday: '14 March 1994',
  address: 'Unit 7, 21 Harbour Lane',
  cardEnding: '4417',
  code: '482913',
  tracking: 'NP 4821 7730',
});

// What the iOS autofill bar offers for each row. The password is never shown, as on iOS.
const AUTOFILL: Record<FieldId, string> = {
  tracking: PROFILE.tracking,
  name: PROFILE.name,
  birthday: PROFILE.birthday,
  address: PROFILE.address,
  id_photo: 'ID card photo',
  password: 'Saved password',
  code: `From Messages ${PROFILE.code}`,
  card: `Card ending ${PROFILE.cardEnding}`,
};

export const autofillFor = (id: FieldId): string => AUTOFILL[id];

// The four bracketed tokens a rewritten card may carry once the player gave that field away.
// deal.ts fills them at deal time like "[institution]".
export const TOKEN_FIELD = {
  'profile name': 'name',
  'profile birthday': 'birthday',
  'profile address': 'address',
  'card ending': 'card',
} as const satisfies Record<string, FieldId>;

export const PROFILE_TOKENS: Record<keyof typeof TOKEN_FIELD, string> = {
  'profile name': PROFILE.name,
  'profile birthday': PROFILE.birthday,
  'profile address': PROFILE.address,
  'card ending': PROFILE.cardEnding,
};
