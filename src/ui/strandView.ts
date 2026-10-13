// Draws the player's strand as beads, folded into a hairpin when it can fold.

import { analyze, type Base } from '../sim';
import { fitCanvas, palette } from './theme';

const R = 12;
const STEP = 27;

type Pt = [number, number];

function layout(seq: string, w: number): { pos: Pt[]; pairs: [number, number][] } {
  const a = analyze(seq);
  let pos: Pt[] = [];
  const pairs: [number, number][] = [];
  if (a.fold) {
    const { i, j, s: st, loop } = a.fold;
    const cx = w / 2;
    const half = 27;
    const loopR = Math.max(26, (loop.length * STEP) / (2 * Math.PI) + 10);
    const stemTop = loopR * 2 + 26;
    const baseY = stemTop + (st - 1) * STEP;
    for (let k = 0; k < st; k++) {
      pos[i + st - 1 - k] = [cx - half, stemTop + k * STEP];
      pos[j + k] = [cx + half, stemTop + k * STEP];
      pairs.push([i + k, j + st - 1 - k]);
    }
    // Loop on a circle above the stem.
    const lcY = stemTop - loopR + 2;
    const n = loop.length;
    const off = Math.asin(Math.min(1, half / loopR));
    const a0 = Math.PI / 2 + off;
    const a1 = Math.PI / 2 - off + 2 * Math.PI;
    for (let k = 0; k < n; k++) {
      const t = a0 + ((a1 - a0) * (k + 1)) / (n + 1);
      pos[i + st + k] = [cx + loopR * Math.cos(t), lcY + loopR * Math.sin(t)];
    }
    // Dangling ends.
    for (let k = 0; k < i; k++) {
      const d = i - k;
      pos[k] = [cx - half - d * 15, baseY + d * 21];
    }
    for (let k = j + st; k < seq.length; k++) {
      const d = k - (j + st) + 1;
      pos[k] = [cx + half + d * 15, baseY + d * 21];
    }
    const xs = pos.map((p) => p[0]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    if (minX < R + 4 || maxX > w - R - 4) {
      const sc = Math.min(1, (w - 2 * R - 8) / (maxX - minX));
      pos = pos.map((p) => [cx + (p[0] - cx) * sc, p[1]]);
    }
  } else {
    // Snake back and forth.
    const per = Math.max(4, Math.floor((w - 2 * R) / STEP));
    for (let k = 0; k < seq.length; k++) {
      const r = Math.floor(k / per);
      const c = k % per;
      const x = r % 2 ? per - 1 - c : c;
      pos[k] = [R + 6 + x * STEP, R + 26 + r * 34];
    }
  }
  return { pos, pairs };
}

export function drawStrand(cv: HTMLCanvasElement, seq: string): void {
  const P = palette();
  const w = cv.clientWidth || 340;
  if (!seq.length) {
    const { ctx } = fitCanvas(cv, 120);
    ctx.clearRect(0, 0, w, 120);
    ctx.fillStyle = P.muted;
    ctx.font = `14px ${P.bodyFont}`;
    ctx.textAlign = 'center';
    ctx.fillText('Tap the bases below to build a strand.', w / 2, 60);
    return;
  }
  const a = analyze(seq);
  const { pos, pairs } = layout(seq, w);
  const H = Math.max(120, Math.max(...pos.map((p) => p[1])) + R + 14);
  const { ctx } = fitCanvas(cv, H);
  ctx.clearRect(0, 0, w, H);

  ctx.strokeStyle = P.line;
  ctx.lineWidth = 3;
  ctx.beginPath();
  pos.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.stroke();

  // Two lines for A·U, three for G·C, like hydrogen bonds.
  ctx.strokeStyle = P.muted;
  ctx.lineWidth = 1.5;
  for (const [p, q] of pairs) {
    const gc = seq[p] === 'G' || seq[p] === 'C';
    const [x1, y1] = pos[p];
    const [x2, y2] = pos[q];
    for (const o of gc ? [-3, 0, 3] : [-2, 2]) {
      ctx.beginPath();
      ctx.moveTo(x1 + R, y1 + o);
      ctx.lineTo(x2 - R, y2 + o);
      ctx.stroke();
    }
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 13px ${P.monoFont}`;
  [...seq].forEach((b, k) => {
    const [x, y] = pos[k];
    ctx.fillStyle = P.base[b as Base];
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = b === 'G' ? P.panel : '#fff';
    ctx.fillText(b, x, y + 1);
  });

  ctx.fillStyle = P.muted;
  ctx.font = `11px ${P.monoFont}`;
  const p0 = pos[0];
  const pn = pos[seq.length - 1];
  ctx.fillText('5′', p0[0], p0[1] - R - 8);
  ctx.fillText('3′', pn[0] + R + 8, pn[1]);
  if (a.catalytic && a.fold) {
    const lp = pos[a.fold.i + a.fold.s + Math.floor(a.fold.loop.length / 2)];
    ctx.fillStyle = P.accent;
    ctx.font = `600 11px ${P.monoFont}`;
    ctx.textAlign = 'left';
    ctx.fillText('◆ catalytic loop', Math.min(w - 110, lp[0] + 50), 16);
  }
}
