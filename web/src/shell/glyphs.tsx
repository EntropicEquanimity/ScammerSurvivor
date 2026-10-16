// Drawn for this app, plain strokes, the same recipe as Icon.tsx (frame.css .icon): the two the
// lock, the home widget and the lock widgets need that Icon does not draw.
const PATHS = {
  globe: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M3 12h18M12 3c-3.2 3-3.2 15 0 18M12 3c3.2 3 3.2 15 0 18',
  people: 'M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 1 0 0 7M2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14a6.5 6.5 0 0 1 3.5 6',
};

export type GlyphName = keyof typeof PATHS;

export function Glyph({ name, size }: { name: GlyphName; size: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
