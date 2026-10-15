// Drawn for this app. Plain strokes, no borrowed icon set.
const PATHS = {
  notes: 'M6 3h12v18H6zM9 8h6M9 12h6M9 16h3',
  privacy: 'M12 3L4 6v6c0 4 5 8 8 9 3-1 8-5 8-9V6zM9 12l2 2 4-5',
  mail: 'M5 5h10l4 4v11H5zM15 5v5h4M8 13h8M8 16h5',
  wallet: 'M4 7h15v13H4zM4 7V4h11v3M14 12h7v5h-7z',
  back: 'M14 6l-6 6 6 6',
  chevron: 'M10 6l6 6-6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  reply: 'M10 7l-6 5.5 6 5.5M4 12.5h9a7 7 0 0 1 7 7',
  ignore: 'M3 10q9 8 18 0M6.5 13.5L5 16M12 15.5v3M17.5 13.5L19 16',
  block: 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16M6.3 6.3l11.4 11.4',
  call: 'M6 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L15 12l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 4 5a2 2 0 0 1 2-2z',
  wifi: 'M2.5 9.5a14 14 0 0 1 19 0M5.5 13a10 10 0 0 1 13 0M8.5 16.5a5 5 0 0 1 7 0M12 20h.01',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={className ? `icon ${className}` : 'icon'} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
