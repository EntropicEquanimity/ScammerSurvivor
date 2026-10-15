import { useEffect, useState } from 'react';
import type { DayScore, Tally } from '../../../../shared/types.ts';
import type { TellInfo } from './useDay.ts';

// The shareable result as a picture: 1080 by 1350, numbers and the tell name only, never a message,
// a sender or a brand. Drawn on a canvas and shown as a plain image, which the phone's own
// long-press saves. No share, save or copy control: AGENTS.md rule 4 and the policy check forbid
// them, so the picture itself is the whole feature.

interface Props {
  score: DayScore;
  dayNumber: number;
  tells: TellInfo;
  country: string | null;
}

const W = 1080;
const H = 1350;
// Candidate backgrounds in order; the first that loads wins, else a flat paper and ink card.
// The repo ships result-card-bg.jpg; add result-card.png in front if an art agent lands one.
const BACKGROUNDS = ['/art/result-card-bg.jpg'];
const PAPER = '#eef0f3';
const INK = '#1c2027';
const INK_2 = '#4a505a';
const FONT = "-apple-system, system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('no background'));
    img.src = src;
  });

async function firstBackground(): Promise<HTMLImageElement | null> {
  for (const src of BACKGROUNDS) {
    try {
      return await loadImage(src);
    } catch {
      // Try the next one.
    }
  }
  return null;
}

// Cover-fit: scale to fill, crop the overflow, centred.
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement): void {
  const scale = Math.max(W / img.width, H / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  // A soft paper wash so the ink stays readable on any art.
  ctx.fillStyle = 'rgba(238, 240, 243, 0.78)';
  ctx.fillRect(0, 0, W, H);
}

const fraction = (t: Tally): string => `${t.handled} of ${t.total}`;

interface Line {
  text: string;
  size: number;
  weight: number;
  colour: string;
  gapAfter: number;
}

function linesFor({ score, dayNumber, tells, country }: Props): Line[] {
  const missed = score.tellMostMissed;
  const missedLabel = missed ? (tells[missed]?.label ?? missed.replaceAll('_', ' ')) : null;
  return [
    // ponytail: the product name is pending (AGENTS.md), so the heading is the day count; swap the
    // first line for the name once the naming step lands.
    { text: `Day ${dayNumber}`, size: 96, weight: 800, colour: INK, gapAfter: 48 },
    { text: 'on my practice phone', size: 52, weight: 500, colour: INK_2, gapAfter: 140 },
    { text: `Scams caught ${fraction(score.scamsCaught)}`, size: 64, weight: 700, colour: INK, gapAfter: 40 },
    { text: `Real messages trusted ${fraction(score.realTrusted)}`, size: 64, weight: 700, colour: INK, gapAfter: 120 },
    ...(missedLabel ? [{ text: `missed tell: ${missedLabel.toLowerCase()}`, size: 44, weight: 500, colour: INK_2, gapAfter: 100 }] : []),
    ...(country ? [{ text: country, size: 44, weight: 600, colour: INK_2, gapAfter: 0 }] : []),
  ];
}

function drawLines(ctx: CanvasRenderingContext2D, lines: Line[]): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const total = lines.reduce((sum, line) => sum + line.size * 1.2 + line.gapAfter, 0);
  lines.reduce((y, line) => {
    ctx.font = `${line.weight} ${line.size}px ${FONT}`;
    ctx.fillStyle = line.colour;
    ctx.fillText(line.text, W / 2, y, W - 120);
    return y + line.size * 1.2 + line.gapAfter;
  }, (H - total) / 2);
}

async function render(props: Props): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  const art = await firstBackground();
  if (art) drawCover(ctx, art);
  drawLines(ctx, linesFor(props));
  ctx.font = `500 32px ${FONT}`;
  ctx.fillStyle = INK_2;
  ctx.fillText('Practice. Not a real message.', W / 2, H - 90);
  return canvas.toDataURL('image/png');
}

// ponytail: rendered once per mount into a data URL; a page that renders many cards would want a blob URL.
export function ResultCard(props: Props) {
  const [src, setSrc] = useState('');
  const { score, dayNumber, tells, country } = props;
  useEffect(() => {
    let current = true;
    render({ score, dayNumber, tells, country }).then((url) => current && setSrc(url), () => undefined);
    return () => {
      current = false;
    };
  }, [score, dayNumber, tells, country]);
  const caption = `Day ${dayNumber} on my practice phone: scams caught ${fraction(score.scamsCaught)}, real messages trusted ${fraction(score.realTrusted)}.`;
  return (
    <figure className="result-card">
      {src ? <img src={src} alt={caption} width={W} height={H} /> : <div className="result-card-blank" aria-hidden="true" />}
      <figcaption>Your result card. Press and hold the picture to keep it.</figcaption>
    </figure>
  );
}
