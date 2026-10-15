import type { CSSProperties } from 'react';
import type { Layout, PublicCard } from '../../../../shared/types.ts';
import { haptic } from '../../shell/feel.ts';
import { appLookFor } from '../day/appNames.ts';

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
  bannerHint?: PublicCard['bannerHint']; // the phone's own "Likely scam" strip, a hint, never proof
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

// In tap mode a part is a button that lifts when marked and takes a neutral stamp; the tell's name
// comes back only after scoring, in the lesson, through `labels`.
export function PartView({ part, tap, labels = [] }: { part: Part; tap?: TapMode; labels?: string[] }) {
  if (tap) {
    const on = tap.pressed.includes(part.id);
    const toggle = () => {
      haptic();
      tap.onToggle(part.id);
    };
    return (
      <button type="button" className="part part-tap pressable" aria-pressed={on} onClick={toggle}>
        <span className="part-text">
          <PartText text={part.text} />
        </span>
        <span className="part-stamp" aria-hidden="true">
          Marked
        </span>
      </button>
    );
  }
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
  marks: Record<string, string[]>;
  name?: string; // the sender named inside the bubble, the group-chat convention of cloud-chat
}

// One bubble: the parts stacked, each a tappable button in tap mode.
function BubbleGroup({ parts, ask, tap, marks, name }: GroupProps) {
  return (
    <div className={ask ? 'bubble-group bubble-ask' : 'bubble-group'}>
      {name && <strong className="bubble-name">{name}</strong>}
      {parts.map((part) => (
        <PartView key={part.id} part={part} tap={tap} labels={marks[part.id]} />
      ))}
    </div>
  );
}

// One component, eight looks picked by the layout id through CSS (card.css): the bubble shape,
// the read line and where the sender name sits differ; the words and the parts never do.
export function MessageView({ sender, setup, ask, arrivesAt, hideSender, tap, marks = {}, layout = 'sms', bannerHint }: Props) {
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
      {bannerHint === 'likely_scam' && (
        <p className="sys-banner" role="note">
          Likely scam. Detection is a hint, not proof.
        </p>
      )}
      {setup.length > 0 && <BubbleGroup parts={setup} tap={tap} marks={marks} name={nameInBubble} />}
      {ask.length > 0 && <BubbleGroup parts={ask} ask tap={tap} marks={marks} name={setup.length === 0 ? nameInBubble : undefined} />}
      {readLine && !tap && <p className="msg-read">{readLine}</p>}
    </div>
  );
}
