import type { MouseEvent } from 'react';
import type { PublicCard } from '../../../../shared/types.ts';
import { Icon } from '../../shell/Icon.tsx';
import { haptic } from '../../shell/feel.ts';

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
  tap?: TapMode; // every part becomes a select-mode row
  marks?: Record<string, string[]>; // part id to the tell labels shown under it (lesson)
  onPress?: (event: MouseEvent) => void; // the bubbles become buttons that open the actions
}

// Fixture links use .example or .invalid hosts, or a bracketed placeholder. Nothing here navigates.
const LINK = /https?:\/\/|www\.|\.(example|invalid)\b|^\[a link\b/i;

const looksLikeLink = (text: string): boolean => LINK.test(text);

function PartText({ text }: { text: string }) {
  return looksLikeLink(text) ? <span className="fake-link">{text}</span> : <>{text}</>;
}

export function PartView({ part, tap, labels = [] }: { part: Part; tap?: TapMode; labels?: string[] }) {
  if (tap) {
    const on = tap.pressed.includes(part.id);
    const toggle = () => {
      haptic();
      tap.onToggle(part.id);
    };
    return (
      <button type="button" className="inset-row inset-body part-tap pressable" aria-pressed={on} onClick={toggle}>
        <span className="part-mark" aria-hidden="true">
          {on && <Icon name="check" />}
        </span>
        <span>
          <PartText text={part.text} />
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
  onPress?: (event: MouseEvent) => void;
}

// A bubble in the chat; a block of select rows in tap mode; a button when the bubble opens the actions.
function BubbleGroup({ parts, ask, tap, marks, onPress }: GroupProps) {
  if (tap) {
    return (
      <ul className="inset">
        {parts.map((part) => (
          <li key={part.id}>
            <PartView part={part} tap={tap} />
          </li>
        ))}
      </ul>
    );
  }
  const rows = parts.map((part) => <PartView key={part.id} part={part} labels={marks[part.id]} />);
  const className = ask ? 'bubble-group bubble-ask' : 'bubble-group';
  if (onPress) {
    return (
      <button type="button" className={`${className} pressable`} onClick={onPress}>
        {rows}
      </button>
    );
  }
  return <div className={className}>{rows}</div>;
}

// ponytail: one plain look for every layout. The five chat looks, text messages, email and wallet are slice 5.
export function MessageView({ sender, setup, ask, arrivesAt, hideSender, tap, marks = {}, onPress }: Props) {
  return (
    <div className="msg">
      {!hideSender && (
        <p className="msg-sender">
          <strong>{sender.displayName}</strong>
          <span>{sender.maskedNumber}</span>
          {arrivesAt && <span>{arrivesAt}</span>}
        </p>
      )}
      {setup.length > 0 && <BubbleGroup parts={setup} tap={tap} marks={marks} onPress={onPress} />}
      {ask.length > 0 && <BubbleGroup parts={ask} ask tap={tap} marks={marks} onPress={onPress} />}
    </div>
  );
}
