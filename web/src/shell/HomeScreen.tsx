import { useRef } from 'react';
import type { CSSProperties, MouseEvent, RefObject } from 'react';
import { BRANDS } from '../../../shared/brands.ts';
import type { CountryPack, Layout } from '../../../shared/types.ts';
import type { PackSummary } from '../api.ts';
import { ScreenTitle } from './PhoneShell.tsx';
import { countryName } from './country.ts';
import { haptic, rememberTap } from './feel.ts';

// One piece of generated art per made-up app, plus the two phone tools. The colour fills the
// squircle while the image loads or if it is missing, so the grid still reads.
const ART = {
  quillo: { src: '/art/quillo.png', colour: BRANDS.quillo.colour, label: BRANDS.quillo.name },
  fieldpost: { src: '/art/fieldpost.png', colour: BRANDS.fieldpost.colour, label: BRANDS.fieldpost.name },
  fold: { src: '/art/fold.png', colour: BRANDS.fold.colour, label: BRANDS.fold.name },
  relay: { src: '/art/relay.png', colour: BRANDS.relay.colour, label: BRANDS.relay.name },
  sms: { src: '/art/sms.png', colour: '#5b6b7c', label: 'Messages' },
  practice: { src: '/art/practice.png', colour: '#2f6bd6', label: 'My practice' },
  privacy: { src: '/art/privacy.png', colour: '#4a505a', label: 'Privacy' },
} as const;

type ArtId = keyof typeof ART;

const APP_ARTS = ['quillo', 'sms', 'fold', 'fieldpost', 'relay'] as const satisfies readonly ArtId[];

type AppArtId = (typeof APP_ARTS)[number];

// ponytail: every chat look shares the one chat app until shared/brands.ts grows a brand per look.
const ART_FOR_LAYOUT: Record<Layout, AppArtId> = {
  'green-chat': 'quillo',
  'blue-chat': 'quillo',
  'sticker-chat': 'quillo',
  'cloud-chat': 'quillo',
  'purple-chat': 'quillo',
  email: 'fieldpost',
  wallet: 'fold',
  call: 'relay',
  sms: 'sms',
};

// The layout a tile opens when the pack deals that app nothing: the app in its plain look, empty.
const DEFAULT_LAYOUT: Record<AppArtId, Layout> = {
  quillo: 'green-chat',
  sms: 'sms',
  fold: 'wallet',
  fieldpost: 'email',
  relay: 'call',
};

// The pack's own look for that app wins (a dealt card lives there); otherwise the app's default look.
const layoutForTile = (id: AppArtId, packLayouts: Layout[]): Layout =>
  packLayouts.find((layout) => ART_FOR_LAYOUT[layout] === id) ?? DEFAULT_LAYOUT[id];

// The widget's source line: the pack's first source, by a short name that holds one line at 320.
// Hand-kept per pack (the full titles live in content/packs); a pack with no source shows none.
// ponytail: a new pack with sources needs a row here; move it into the pack files when they grow a short name.
const SHORT_SOURCE: Record<string, string> = {
  AU: 'Scamwatch',
  HK: 'ADCC',
  ID: 'OJK',
  IN: 'MHA',
  JP: 'NPA',
  MY: 'NSRC',
  SG: 'ScamShield',
};

type PackFacts = Pick<CountryPack, 'code' | 'sources'>;
const PACK_FILES = import.meta.glob<PackFacts>('../../../content/packs/*.json', { eager: true, import: 'default' });
const SOURCED = new Set(Object.values(PACK_FILES).filter((pack) => pack.sources.length > 0).map((pack) => pack.code));

const sourceLine = (code: string): string | undefined =>
  SOURCED.has(code) && SHORT_SOURCE[code] ? `Per ${SHORT_SOURCE[code]}` : undefined;

const NO_PACK: Pick<PackSummary, 'layouts' | 'confidence'> = { layouts: [], confidence: 'low' };

type Tap = MouseEvent<HTMLElement>;

// Every tap on the home: the phone's short buzz and the tap origin for the sheet that opens.
const feel = (event: Tap) => {
  haptic();
  rememberTap(event);
};

const stagger = (index: number) => ({ '--i': index } as CSSProperties);

function AppArt({ id }: { id: ArtId }) {
  const art = ART[id];
  return (
    <span className="app-art" style={{ background: art.colour } as CSSProperties}>
      <img src={art.src} alt="" onError={(event) => { event.currentTarget.style.visibility = 'hidden'; }} />
    </span>
  );
}

interface WidgetProps {
  code: string;
  name: string;
  pack: Pick<PackSummary, 'layouts' | 'confidence'>;
  onPlay: (event: Tap, quick: boolean) => void;
  playRef: RefObject<HTMLButtonElement | null>;
}

// Two square widgets side by side, the way the home screen places them.
function Widgets({ code, name, pack, onPlay, playRef }: WidgetProps) {
  const arts = [...new Set(pack.layouts.slice(0, 3).map((layout) => ART_FOR_LAYOUT[layout]))];
  return (
    <div className="widgets">
      <div className="widget-cell anim-pop" style={stagger(0)}>
        <div className="widget glass glass-strong">
          <ScreenTitle className="widget-title">In {name}, scams arrive on</ScreenTitle>
          <ul className="widget-apps" aria-label="Apps in this country's practice">
            {arts.map((id) => <li key={id}><AppArt id={id} /></li>)}
          </ul>
          {sourceLine(code) && <p className="widget-confidence">{sourceLine(code)}</p>}
        </div>
        <span className="widget-label">Country</span>
      </div>
      <div className="widget-cell anim-pop" style={stagger(1)}>
        <div className="widget glass glass-strong widget-play">
          <button ref={playRef} type="button" className="btn btn-primary pressable" onClick={(event) => onPlay(event, false)}>Full day</button>
          <button type="button" className="btn pressable" aria-label="Quick day, about a minute" onClick={(event) => onPlay(event, true)}>Quick day</button>
        </div>
        <span className="widget-label">Practice</span>
      </div>
    </div>
  );
}

interface GridProps {
  packLayouts: Layout[];
  onOpenApp: (event: Tap, layout: Layout) => void;
}

// Pack apps first, then the rest, then the tools. Every app tile opens that app: the day screen routes
// the layout to its unopened slot, or shows the app empty. Stagger continues after the widgets.
function AppGrid({ packLayouts, onOpenApp }: GridProps) {
  const apps = [...new Set<AppArtId>([...packLayouts.map((layout) => ART_FOR_LAYOUT[layout]), ...APP_ARTS])];
  const tools = apps.length;
  return (
    <ul className="app-grid" aria-label="Apps on this phone">
      {apps.map((id, index) => (
        <li key={id} className="anim-pop" style={stagger(index + 2)}>
          <button type="button" className="app-tile pressable" onClick={(event) => onOpenApp(event, layoutForTile(id, packLayouts))}>
            <AppArt id={id} /><span>{ART[id].label}</span>
          </button>
        </li>
      ))}
      <li className="anim-pop" style={stagger(tools + 2)}>
        <a className="app-tile pressable" href="#/progress" onClick={feel}><AppArt id="practice" /><span>{ART.practice.label}</span></a>
      </li>
      <li className="anim-pop" style={stagger(tools + 3)}>
        <a className="app-tile pressable" href="#/privacy" onClick={feel}><AppArt id="privacy" /><span>{ART.privacy.label}</span></a>
      </li>
    </ul>
  );
}

function Dock({ onPlay, first }: { onPlay: (event: Tap, quick: boolean) => void; first: number }) {
  return (
    <nav className="dock glass anim-pop" aria-label="Phone tools" style={stagger(first)}>
      <button type="button" className="pressable" aria-label="Play a full day" onClick={(event) => onPlay(event, false)}><AppArt id="quillo" /></button>
      <button type="button" className="pressable" aria-label="Quick day, about a minute" onClick={(event) => onPlay(event, true)}><AppArt id="sms" /></button>
      <a className="pressable" href="#/progress" aria-label="My practice" onClick={feel}><AppArt id="practice" /></a>
      <a className="pressable" href="#/privacy" aria-label="Privacy notice" onClick={feel}><AppArt id="privacy" /></a>
    </nav>
  );
}

interface HomeProps {
  country: string;
  pack: PackSummary | undefined; // undefined while the packs list loads or for a country without a pack
  onPlay: (quick: boolean) => void;
  onChangeCountry: () => void;
  // An app tile was tapped: open that app's thread (the day routes it to the matching unopened slot,
  // or shows the app empty). ponytail: optional until App passes it; then make it required and drop the fallback.
  onOpenApp?: (layout: Layout) => void;
}

export function HomeScreen({ country, pack, onPlay, onChangeCountry, onOpenApp }: HomeProps) {
  const playRef = useRef<HTMLButtonElement>(null);
  const layouts = (pack ?? NO_PACK).layouts.slice(0, 3);
  const name = countryName(country);
  const play = (event: Tap, quick: boolean) => {
    feel(event);
    onPlay(quick);
  };
  const openApp = (event: Tap, layout: Layout) => {
    feel(event);
    if (onOpenApp) return onOpenApp(layout);
    playRef.current?.scrollIntoView({ block: 'center' });
    playRef.current?.focus();
  };
  const change = (event: Tap) => {
    feel(event);
    onChangeCountry();
  };
  const tiles = APP_ARTS.length + 2;
  return (
    <section className="page home">
      <Widgets code={country} name={name} pack={pack ?? NO_PACK} onPlay={play} playRef={playRef} />
      <AppGrid packLayouts={layouts} onOpenApp={openApp} />
      <button type="button" className="search-pill glass glass-strong pressable anim-pop" style={stagger(tiles + 2)} onClick={change}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13M15.5 15.5L20 20" /></svg>
        <span>{name}</span>
        <span className="search-change">Change</span>
      </button>
      <Dock onPlay={play} first={tiles + 3} />
    </section>
  );
}
