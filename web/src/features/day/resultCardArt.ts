// The result card's drawing: the night-glow art from the repo, white type in the iOS system face,
// two glass tiles. 1080 by 1350. Text only from CardText, so nothing from a message ever lands here.

export interface CardText {
  product: string;
  day: string;
  big: string;
  bigLabel: string;
  tiles: { value: string; label: string }[];
  watch: string;
}

const W = 1080;
const H = 1350;
const PAD = 88;
const BACKGROUND = '/art/result-card-bg.jpg';
const NIGHT = '#06122b'; // the art's own deep blue, the fill when the art is missing
const WHITE = '#ffffff';
const SOFT = 'rgba(255, 255, 255, 0.78)';
const FONT = "-apple-system, system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('no background'));
    img.src = src;
  });

// Cover-fit art, then an accent glow from the top and a shade at the foot so white type reads anywhere.
function drawBackground(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null): void {
  ctx.fillStyle = NIGHT;
  ctx.fillRect(0, 0, W, H);
  if (img) {
    const scale = Math.max(W / img.width, H / img.height);
    ctx.drawImage(img, (W - img.width * scale) / 2, (H - img.height * scale) / 2, img.width * scale, img.height * scale);
  }
  const glow = ctx.createRadialGradient(W * 0.3, 0, 0, W * 0.3, 0, W * 1.1);
  glow.addColorStop(0, 'rgba(10, 112, 232, 0.55)');
  glow.addColorStop(1, 'rgba(10, 112, 232, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const shade = ctx.createLinearGradient(0, H * 0.55, 0, H);
  shade.addColorStop(0, 'rgba(4, 10, 26, 0)');
  shade.addColorStop(1, 'rgba(4, 10, 26, 0.6)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, weight: number, colour: string): void {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = colour;
  ctx.fillText(value, x, y, W - PAD * 2);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Two glass tiles side by side: the figure large, its label under it.
function drawTiles(ctx: CanvasRenderingContext2D, tiles: CardText['tiles'], top: number): void {
  const gap = 32;
  const w = (W - PAD * 2 - gap) / 2;
  const h = 230;
  tiles.forEach((tile, i) => {
    const x = PAD + i * (w + gap);
    roundRect(ctx, x, top, w, h, 44);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    text(ctx, tile.value, x + w / 2, top + 56, 76, 700, WHITE);
    text(ctx, tile.label, x + w / 2, top + 152, 36, 500, SOFT);
  });
}

export async function drawCard(ctx: CanvasRenderingContext2D, card: CardText): Promise<void> {
  drawBackground(ctx, await loadImage(BACKGROUND).catch(() => null));
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  text(ctx, card.product, W / 2, 132, 72, 800, WHITE);
  text(ctx, card.day, W / 2, 236, 46, 600, SOFT);
  text(ctx, card.big, W / 2, 360, 240, 800, WHITE);
  text(ctx, card.bigLabel, W / 2, 640, 44, 600, SOFT);
  drawTiles(ctx, card.tiles, 780);
  ctx.textAlign = 'center';
  text(ctx, card.watch, W / 2, 1080, 42, 600, WHITE);
  text(ctx, 'Practice. Not a real message.', W / 2, H - 112, 30, 500, SOFT);
}
