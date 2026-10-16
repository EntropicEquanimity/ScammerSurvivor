import { useRef } from 'react';
import type { CSSProperties, MouseEvent, RefObject } from 'react';
import { BRANDS } from '../../../shared/brands.ts';
import type { Layout } from '../../../shared/types.ts';
import type { PackSummary } from '../api.ts';
import { ScreenTitle } from './PhoneShell.tsx';
import { countryName } from './country.ts';
import { haptic, rememberTap } from './feel.ts';
import { TELLS } from '../../../shared/taxonomy.ts';
import { pickBoss, readTally } from '../../../shared/boss.ts';

// One piece of generated art per made-up app, plus the two phone tools. The colour fills the
// squircle while the image loads or if it is missing, so the grid still reads.
const ART = {
  quillo: { src: '/art/quillo.png', colour: BRANDS.quillo.colour, label: BRANDS.quillo.name },
  fieldpost: { src: '/art/fieldpost.png', colour: BRANDS.fieldpost.colour, label: BRANDS.fieldpost.name },
  fold: { src: '/art/fold.png', colour: BRANDS.fold.colour, label: BRANDS.fold.name },
  relay: { src: '/art/relay.png', colour: BRANDS.relay.colour, label: BRANDS.relay.name },
  sms: { src: '/art/sms.png', colour: '#3ac74c', label: 'Messages' },
  practice: { src: '/art/practice.png', colour: '#ec3f48', label: 'My practice' },
  privacy: { src: '/art/privacy.png', colour: '#95999f', label: 'Privacy' },
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
  name: string;
  onPlay: (event: Tap, quick: boolean) => void;
  onChange: (event: Tap) => void;
  playRef: RefObject<HTMLButtonElement | null>;
}

// One medium widget is the only way to start: the day, the boss you keep missing, Play, and a
// quieter Quick day. The country lives on the widget so nothing else on the home looks like a form.
function DayWidget({ name, onPlay, onChange, playRef }: WidgetProps) {
  const boss = pickBoss(readTally());
  return (
    <div className="widgets widgets-one">
      <div className="widget-cell anim-pop" style={stagger(0)}>
        <div className="widget glass glass-strong widget-day">
          <div className="widget-day-text">
            <ScreenTitle className="widget-title">Your practice day</ScreenTitle>
            <p className="widget-line">{boss ? `Boss: ${TELLS[boss].label}` : 'Messages arrive. Spot the scams.'}</p>
            <button type="button" className="widget-country pressable" onClick={onChange}>{name}</button>
          </div>
          <div className="widget-day-actions">
            <button ref={playRef} type="button" className="btn btn-primary pressable" onClick={(event) => onPlay(event, false)}>Play</button>
            <button type="button" className="widget-quick pressable" aria-label="Quick day, about a minute" onClick={(event) => onPlay(event, true)}>Quick day</button>
          </div>
        </div>
        <span className="widget-label">Scammer Survivor</span>
      </div>
    </div>
  );
}

interface GridProps {
  packLayouts: Layout[];
  onOpenApp: (event: Tap, layout: Layout) => void;
}

// The apps not in the dock, then the tools. Every app tile opens that app: the day screen routes
// the layout to its unopened slot, or shows the app empty. Stagger continues after the widgets.
function AppGrid({ packLayouts, onOpenApp }: GridProps) {
  const apps = [...new Set<AppArtId>([...packLayouts.map((layout) => ART_FOR_LAYOUT[layout]), ...APP_ARTS])].filter((id) => !DOCK_APPS.includes(id));
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

const DOCK_APPS: readonly AppArtId[] = ['sms', 'quillo', 'fieldpost', 'relay'];

// The dock holds four apps and each one only opens its app, as on the phone. Play lives on the widget.
function Dock({ packLayouts, onOpenApp, first }: GridProps & { first: number }) {
  return (
    <nav className="dock glass anim-pop" aria-label="Dock" style={stagger(first)}>
      {DOCK_APPS.map((id) => (
        <button key={id} type="button" className="pressable" aria-label={ART[id].label} onClick={(event) => onOpenApp(event, layoutForTile(id, packLayouts))}>
          <AppArt id={id} />
        </button>
      ))}
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
      <DayWidget name={name} onPlay={play} onChange={change} playRef={playRef} />
      <AppGrid packLayouts={layouts} onOpenApp={openApp} />
      <Dock packLayouts={layouts} onOpenApp={openApp} first={tiles + 2} />
    </section>
  );
}
