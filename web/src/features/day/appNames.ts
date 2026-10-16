import { BRANDS } from '../../../../shared/brands.ts';
import type { BrandId } from '../../../../shared/brands.ts';
import type { Layout } from '../../../../shared/types.ts';

// ponytail: slice 5 records each layout's own brand in shared/brands.ts. Until then the four
// existing made-up apps cover the looks, and text messages carry no app name at all.
const LAYOUT_BRAND: Partial<Record<Layout, BrandId>> = {
  'green-chat': 'quillo',
  'blue-chat': 'quillo',
  'sticker-chat': 'quillo',
  'cloud-chat': 'quillo',
  'purple-chat': 'quillo',
  email: 'fieldpost',
  wallet: 'fold',
  call: 'relay',
};

// Messages (text messages) have no brand: the phone's own green, never a real carrier's colour.
const SMS_COLOUR = '#3ac74c';

export interface AppLook {
  name: string;
  art: string; // generated icon under /art, a full-bleed square
  colour: string; // the made-up app's own colour, used as the icon fallback and the header tint
}

export function appLookFor(layout: Layout): AppLook {
  const id = LAYOUT_BRAND[layout];
  if (!id) return { name: 'Messages', art: '/art/sms.png', colour: SMS_COLOUR };
  return { name: BRANDS[id].name, art: `/art/${id}.png`, colour: BRANDS[id].colour };
}

export const appNameFor = (layout: Layout): string => appLookFor(layout).name;
