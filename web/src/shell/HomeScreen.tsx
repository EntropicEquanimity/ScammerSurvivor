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
  kwentuhan: { src: '/art/kwentuhan.png', colour: BRANDS.kwentuhan.colour, label: BRANDS.kwentuhan.name },
  fieldpost: { src: '/art/fieldpost.png', colour: BRANDS.fieldpost.colour, label: BRANDS.fieldpost.name },
  fold: { src: '/art/fold.png', colour: BRANDS.fold.colour, label: BRANDS.fold.name },
  relay: { src: '/art/relay.png', colour: BRANDS.relay.colour, label: BRANDS.relay.name },
  sms: { src: '/art/sms.png', colour: '#5b6b7c', label: 'Text messages' },
  practice: { src: '/art/practice.png', colour: '#2f6bd6', label: 'My practice' },
  privacy: { src: '/art/privacy.png', colour: '#4a505a', label: 'Privacy' },
} as const;

type ArtId = keyof typeof ART;

const APP_ARTS: ArtId[] = ['kwentuhan', 'sms', 'fold', 'fieldpost', 'relay'];

// ponytail: every chat look shares the one chat app until shared/brands.ts grows a brand per look.
const ART_FOR_LAYOUT: Record<Layout, ArtId> = {
  'green-chat': 'kwentuhan',
  'blue-chat': 'kwentuhan',
  'sticker-chat': 'kwentuhan',
  'cloud-chat': 'kwentuhan',
  'purple-chat': 'kwentuhan',
  email: 'fieldpost',
  wallet: 'fold',
  call: 'relay',
  sms: 'sms',
};

const CONFIDENCE_WORDS: Record<CountryPack['confidence'], string> = {
  high: 'from police statistics',
  medium: 'based on usage',
  low: 'based on usage',
};

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
  pack: Pick<PackSummary, 'layouts' | 'confidence'>;
  onPlay: (event: Tap, quick: boolean) => void;
  playRef: RefObject<HTMLButtonElement | null>;
}

// Two square widgets side by side, the way the home screen places them.
function Widgets({ name, pack, onPlay, playRef }: WidgetProps) {
  const arts = [...new Set(pack.layouts.slice(0, 3).map((layout) => ART_FOR_LAYOUT[layout]))];
  return (
    <div className="widgets">
      <div className="widget-cell anim-pop" style={stagger(0)}>
        <div className="widget glass glass-strong">
          <ScreenTitle className="widget-title">In {name}, scams arrive on</ScreenTitle>
          <ul className="widget-apps" aria-label="Apps in this country's practice">
            {arts.map((id) => <li key={id}><AppArt id={id} /></li>)}
          </ul>
          <p className="widget-confidence">{CONFIDENCE_WORDS[pack.confidence]}</p>
        </div>
        <span className="widget-label">Country</span>
      </div>
      <div className="widget-cell anim-pop" style={stagger(1)}>
        <div className="widget glass glass-strong widget-play">
          <button ref={playRef} type="button" className="btn btn-primary pressable" onClick={(event) => onPlay(event, false)}>Play a full day</button>
          <button type="button" className="btn pressable" onClick={(event) => onPlay(event, true)}>Quick day<span className="widget-sub">about a minute</span></button>
        </div>
        <span className="widget-label">Practice</span>
      </div>
    </div>
  );
}

interface GridProps {
  packArts: ArtId[];
  onFocusPlay: (event: Tap) => void;
}

// Pack apps first, then the apps other countries use (dimmed, coming to this deck), then the tools.
// No tile is dead: every app tile leads to the widget's Play button. Stagger continues after the widgets.
function AppGrid({ packArts, onFocusPlay }: GridProps) {
  const rest = APP_ARTS.filter((id) => !packArts.includes(id));
  const apps = [...packArts.map((id) => ({ id, soon: false })), ...rest.map((id) => ({ id, soon: true }))];
  const tools = apps.length;
  return (
    <ul className="app-grid" aria-label="Apps on this phone">
      {apps.map(({ id, soon }, index) => (
        <li key={id} className="anim-pop" style={stagger(index + 2)}>
          <button
            type="button"
            className={soon ? 'app-tile app-tile-soon pressable' : 'app-tile pressable'}
            aria-label={soon ? `${ART[id].label}, coming to this country's deck` : undefined}
            onClick={onFocusPlay}
          >
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
      <button type="button" className="pressable" aria-label="Play a full day" onClick={(event) => onPlay(event, false)}><AppArt id="kwentuhan" /></button>
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
}

export function HomeScreen({ country, pack, onPlay, onChangeCountry }: HomeProps) {
  const playRef = useRef<HTMLButtonElement>(null);
  const layouts = (pack ?? NO_PACK).layouts.slice(0, 3);
  const packArts = [...new Set(layouts.map((layout) => ART_FOR_LAYOUT[layout]))];
  const name = countryName(country);
  const play = (event: Tap, quick: boolean) => {
    feel(event);
    onPlay(quick);
  };
  const focusPlay = (event: Tap) => {
    feel(event);
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
      <Widgets name={name} pack={pack ?? NO_PACK} onPlay={play} playRef={playRef} />
      <AppGrid packArts={packArts} onFocusPlay={focusPlay} />
      <button type="button" className="search-pill glass glass-strong pressable anim-pop" style={stagger(tiles + 2)} onClick={change}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13M15.5 15.5L20 20" /></svg>
        <span>{name}</span>
        <span className="search-change">Change</span>
      </button>
      <Dock onPlay={play} first={tiles + 3} />
    </section>
  );
}
