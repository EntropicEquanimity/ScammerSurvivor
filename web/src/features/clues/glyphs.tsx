// The clue faces' small marks, drawn for this app in the same plain strokes as shell/Icon.tsx.
// Decorative: the button's label carries the meaning.
const GLYPHS = {
  globe: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  timer: 'M12 7a7 7 0 1 0 0 14a7 7 0 1 0 0-14M12 10.5v3.5l2 1.5M10 3h4',
  seal: 'M12 2.5l2.4 1.8 3-.2.9 2.8 2.5 1.7-1 2.8 1 2.8-2.5 1.7-.9 2.8-3-.2L12 21.5l-2.4-1.8-3 .2-.9-2.8-2.5-1.7 1-2.8-1-2.8 2.5-1.7.9-2.8 3 .2zM8.5 12.2l2.4 2.4 4.6-4.8',
  play: 'M9 7l8 5-8 5z',
  inspect: 'M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13M15.2 15.2L20 20',
  turn: 'M5 12a7 7 0 1 0 2-5M5 4v3.5h3.5',
};

export type GlyphName = keyof typeof GLYPHS;

export function Glyph({ name }: { name: GlyphName }) {
  return (
    <svg className={`clue-glyph clue-glyph-${name}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={GLYPHS[name]} />
    </svg>
  );
}
