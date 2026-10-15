import type { Layout } from '../../../../shared/types.ts';
import { appLookFor } from './appNames.ts';

// A squircle app icon. The art is decorative: the app name sits next to it as text. If the PNG is
// missing the brand colour fills the square, so the layout still reads.
export function AppIcon({ layout, size }: { layout: Layout; size: number }) {
  const look = appLookFor(layout);
  return (
    <img
      className="app-icon"
      src={look.art}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size, backgroundColor: look.colour }}
    />
  );
}
