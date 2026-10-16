import { useEffect, useState } from 'react';
import type { DayScore, Tally } from '../../../../shared/types.ts';
import type { TellInfo } from './useDay.ts';
import { drawCard } from './resultCardArt.ts';
import type { CardText } from './resultCardArt.ts';

// The shareable result as a picture: 1080 by 1350, numbers and the tell name only, never a message,
// a sender or a brand. Drawn on a canvas and shown as a plain image, which the phone's own
// long-press saves. No share, save or copy control: AGENTS.md rule 4 and the policy check forbid
// them, so the picture itself is the whole feature.

interface Props {
  score: DayScore;
  dayNumber: number;
  tells: TellInfo;
  points?: number; // the day's game points; without them the card leads with the share handled safely
  checked?: number; // real messages checked by a call: safe, so they count in the day line, but not as trusted
}

const W = 1080;
const H = 1350;
const PRODUCT = 'Scammer Survivor';
const fraction = (t: Tally): string => `${t.handled} of ${t.total}`;

// The words on the card, from the score alone. Exported for the caption and kept pure.
export function cardText({ score, dayNumber, tells, points, checked = 0 }: Props): CardText {
  const safe = score.scamsCaught.handled + score.realTrusted.handled + checked;
  const total = score.scamsCaught.total + score.realTrusted.total;
  const missed = score.tellMostMissed;
  const missedLabel = missed ? (tells[missed]?.label ?? missed.replaceAll('_', ' ')) : null;
  const percent = total > 0 ? Math.round((safe / total) * 100) : 0;
  return {
    product: PRODUCT,
    day: `Day ${dayNumber}: ${safe} of ${total} safe`,
    big: points !== undefined ? points.toLocaleString('en') : `${percent}%`,
    bigLabel: points !== undefined ? 'points' : 'handled safely',
    tiles: [
      { value: fraction(score.scamsCaught), label: 'Scams caught' },
      { value: fraction(score.realTrusted), label: 'Real ones trusted' },
    ],
    watch: missedLabel ? `Watch for: ${missedLabel.toLowerCase()}` : 'No tell got past you',
  };
}

async function render(props: Props): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  await drawCard(ctx, cardText(props));
  return canvas.toDataURL('image/png');
}

// ponytail: rendered once per mount into a data URL; a page that renders many cards would want a blob URL.
export function ResultCard(props: Props) {
  const [src, setSrc] = useState('');
  const { score, dayNumber, tells, points, checked } = props;
  useEffect(() => {
    let current = true;
    render({ score, dayNumber, tells, points, checked }).then((url) => current && setSrc(url), () => undefined);
    return () => {
      current = false;
    };
  }, [score, dayNumber, tells, points, checked]);
  const text = cardText(props);
  const caption = `${PRODUCT}, ${text.day}. ${text.big} ${text.bigLabel}. Scams caught ${fraction(score.scamsCaught)}, real messages trusted ${fraction(score.realTrusted)}.`;
  return (
    <figure className="result-card">
      {src ? <img src={src} alt={caption} width={W} height={H} /> : <div className="result-card-blank" aria-hidden="true" />}
      <figcaption>Your result card. Press and hold the picture to keep it.</figcaption>
    </figure>
  );
}
