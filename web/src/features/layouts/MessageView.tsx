import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Clue } from '../../../../shared/clues.ts';
import type { Layout, PublicCard } from '../../../../shared/types.ts';
import { haptic } from '../../shell/feel.ts';
import { appLookFor } from '../day/appNames.ts';
import { ClueStack } from '../clues/ClueCard.tsx';
import { HistoryBubbles } from './History.tsx';

export interface Part {
  id: string;
  text: string;
}

export interface TapMode {
  pressed: string[];
  onToggle: (id: string) => void;
}

interface Props {
  sender: PublicCard['sender'];
  setup: Part[];
  ask: Part[];
  arrivesAt?: string;
  hideSender?: boolean; // the app header already names the sender
  tap?: TapMode; // every part becomes a tappable span that lifts and takes a stamp
  marks?: Record<string, string[]>; // part id to the tell labels shown under it (lesson)
  layout?: Layout; // picks the look; text messages when absent
  bannerHint?: PublicCard['bannerHint']; // the phone's unknown-sender line, as iOS shows it; shown on some scams and some real messages, never proof
  clues?: Clue[]; // the card's inspectable objects, each drawn under the part it names
  history?: PublicCard['history']; // earlier days of a rapport chat, drawn above today (History.tsx)
}

// Fixture links use .example or .invalid hosts, or a bracketed placeholder. Nothing here navigates.
const LINK = /https?:\/\/|www\.|\.(example|invalid)\b|^\[a link\b/i;

const looksLikeLink = (text: string): boolean => LINK.test(text);

// The read line under the last bubble, in words: never a pair of blue ticks (docs/ux-plan.md).
const READ_LINE: Partial<Record<Layout, string>> = {
  'green-chat': 'Delivered',
  'blue-chat': 'Seen',
  'sticker-chat': 'Read',
  'cloud-chat': 'Delivered',
  'purple-chat': 'Seen',
};

function PartText({ text }: { text: string }) {
  return looksLikeLink(text) ? <span className="fake-link">{text}</span> : <>{text}</>;
}

// A part in tap mode: a button that lifts when flagged and takes a red-flag stamp, "Flagged as
// suspicious" (playtest, Oct 16: flagging always means suspicious), and shivers when a flag is taken back. The client never knows which parts are tells, so the shiver is the only
// "wrong tap" it can show. The tell's name comes back only after scoring, in the lesson.
function TapPart({ part, tap }: { part: Part; tap: TapMode }) {
  const [shiver, setShiver] = useState(false);
  const on = tap.pressed.includes(part.id);
  const toggle = () => {
    haptic();
    if (on) setShiver(true);
    tap.onToggle(part.id);
  };
  const className = shiver ? 'part part-tap part-shiver pressable' : 'part part-tap pressable';
  return (
    <button type="button" className={className} aria-pressed={on} onClick={toggle} onAnimationEnd={() => setShiver(false)}>
      <span className="part-text">
        <PartText text={part.text} />
      </span>
      <span className="part-stamp" aria-hidden="true">
        <svg className="part-flag" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
          <path d="M3 1.5v13M3 2.5h8.5l-2 3 2 3H3" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
        Flagged as suspicious
      </span>
    </button>
  );
}

interface PartProps {
  part: Part;
  tap?: TapMode;
  labels?: string[];
  clues?: Clue[]; // this part's clues only
  open?: boolean; // the lesson: clues start turned over
}

// A part with its clues under it. In select mode the clue is a sibling of the part's button, never
// inside it: tapping the part marks it, tapping the clue only inspects it.
export function PartView({ part, tap, labels, clues = [], open }: PartProps) {
  if (clues.length === 0) return <PartBody part={part} tap={tap} labels={labels} />;
  const Wrap = tap ? 'div' : 'span';
  return (
    <Wrap className={tap ? 'part-area' : 'part-with-clues'}>
      <PartBody part={part} tap={tap} labels={labels} />
      <ClueStack clues={clues} open={open} />
    </Wrap>
  );
}

function PartBody({ part, tap, labels = [] }: { part: Part; tap?: TapMode; labels?: string[] }) {
  if (tap) return <TapPart part={part} tap={tap} />;
  if (labels.length === 0) {
    return (
      <span className="part">
        <PartText text={part.text} />
      </span>
    );
  }
  return (
    <span className="part part-marked">
      <span className="part-marked-text">
        <PartText text={part.text} />
      </span>
      <span className="part-labels">{labels.join(', ')}</span>
    </span>
  );
}

interface GroupProps {
  parts: Part[];
  ask?: boolean;
  tap?: TapMode;
  marks?: Record<string, string[]>; // present in the lesson, where clues start turned over
  clues: Clue[];
  name?: string; // the sender named inside the bubble, the group-chat convention of cloud-chat
}

// One bubble: the parts stacked, each a tappable button in tap mode.
function BubbleGroup({ parts, ask, tap, marks, clues, name }: GroupProps) {
  return (
    <div className={ask ? 'bubble-group bubble-ask' : 'bubble-group'}>
      {name && <strong className="bubble-name">{name}</strong>}
      {parts.map((part) => (
        <PartView key={part.id} part={part} tap={tap} labels={marks?.[part.id]} clues={clues.filter((c) => c.partId === part.id)} open={marks !== undefined} />
      ))}
    </div>
  );
}

// The threads that open with the day's time line, the way a chat shows "Today 08:10" over the first
// bubble. Mail and the wallet have no thread.
const THREADED = (layout: Layout): boolean => layout !== 'email' && layout !== 'wallet';

// One component, eight looks picked by the layout id through CSS (card.css): the bubble shape,
// the read line and where the sender name sits differ; the words and the parts never do. Every
// sibling of a bubble here is a <p>, so the last bubble (the one with the tail) is :last-of-type.
export function MessageView({ sender, setup, ask, arrivesAt, hideSender, tap, marks, layout = 'sms', bannerHint, clues = [], history }: Props) {
  const nameInBubble = layout === 'cloud-chat' ? sender.displayName : undefined;
  const readLine = READ_LINE[layout];
  const palette = { '--app-colour': appLookFor(layout).colour } as CSSProperties;
  return (
    <div className="msg" data-look={layout} data-tap={tap ? '' : undefined} style={palette}>
      {!hideSender && (
        <p className="msg-sender">
          <strong>{sender.displayName}</strong>
          <span>{sender.maskedNumber}</span>
          {arrivesAt && <span>{arrivesAt}</span>}
        </p>
      )}
      <HistoryBubbles history={history} />
      {arrivesAt && THREADED(layout) && (
        <p className="thread-time">
          <strong>Today</strong> {arrivesAt}
        </p>
      )}
      {bannerHint === 'likely_scam' && (
        <p className="sys-banner" role="note">
          The sender is not in your contact list.
        </p>
      )}
      {setup.length > 0 && <BubbleGroup parts={setup} tap={tap} marks={marks} clues={clues} name={nameInBubble} />}
      {ask.length > 0 && <BubbleGroup parts={ask} ask tap={tap} marks={marks} clues={clues} name={setup.length === 0 ? nameInBubble : undefined} />}
      {readLine && !tap && <p className="msg-read">{readLine}</p>}
    </div>
  );
}
