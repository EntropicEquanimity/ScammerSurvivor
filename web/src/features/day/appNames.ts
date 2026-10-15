import { BRANDS } from '../../../../shared/brands.ts';
import type { BrandId } from '../../../../shared/brands.ts';
import type { Layout } from '../../../../shared/types.ts';

// ponytail: slice 5 records each layout's own brand in shared/brands.ts. Until then the four
// existing made-up apps cover the looks, and text messages carry no app name at all.
const LAYOUT_BRAND: Partial<Record<Layout, BrandId>> = {
  'green-chat': 'kwentuhan',
  'blue-chat': 'kwentuhan',
  'sticker-chat': 'kwentuhan',
  'cloud-chat': 'kwentuhan',
  'purple-chat': 'kwentuhan',
  email: 'fieldpost',
  wallet: 'fold',
  call: 'relay',
};

// Text messages have no brand: a neutral grey icon and tint, never a real carrier's colour.
const SMS_COLOUR = '#4a505a';

export interface AppLook {
  name: string;
  art: string; // generated icon under /art, a full-bleed square
  colour: string; // the made-up app's own colour, used as the icon fallback and the header tint
}

export function appLookFor(layout: Layout): AppLook {
  const id = LAYOUT_BRAND[layout];
  if (!id) return { name: 'Text messages', art: '/art/sms.png', colour: SMS_COLOUR };
  return { name: BRANDS[id].name, art: `/art/${id}.png`, colour: BRANDS[id].colour };
}

export const appNameFor = (layout: Layout): string => appLookFor(layout).name;
