// Population over time, with the goal line and engine switch marked.

import type { Level } from '../levels/types';
import { fitCanvas, palette } from './theme';

export interface History {
  yours: number[];
  mutants: number[];
  parasite: number[];
}

export const emptyHistory = (): History => ({ yours: [], mutants: [], parasite: [] });

function niceStep(x: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const f = x / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

export function drawChart(cv: HTMLCanvasElement, level: Level, hist: History, switchedAt: number | null): void {
  const P = palette();
  const { ctx, w, h } = fitCanvas(cv);
  ctx.clearRect(0, 0, w, h);
  const padL = 40, padR = 10, padT = 12, padB = 22;
  const pw = w - padL - padR;
  const ph = h - padT - padB;
  let ymax = level.goal.yours * 1.3;
  for (const series of Object.values(hist)) for (const v of series) ymax = Math.max(ymax, v);
  const step = niceStep(ymax / 4);
  ymax = Math.ceil(ymax / step) * step;
  const X = (t: number) => padL + (t / level.ticks) * pw;
  const Y = (v: number) => padT + ph - (v / ymax) * ph;

  ctx.font = `10px ${P.monoFont}`;
  ctx.fillStyle = P.muted;
  ctx.strokeStyle = P.line;
  ctx.lineWidth = 1;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let v = 0; v <= ymax; v += step) {
    ctx.beginPath();
    ctx.moveTo(padL, Y(v));
    ctx.lineTo(w - padR, Y(v));
    ctx.stroke();
    ctx.fillText(String(v), padL - 6, Y(v));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const t of [0, level.ticks / 2, level.ticks]) ctx.fillText(String(t), X(t), h - padB + 6);

  ctx.strokeStyle = P.accent;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(padL, Y(level.goal.yours));
  ctx.lineTo(w - padR, Y(level.goal.yours));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = P.accent;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText('goal ' + level.goal.yours, padL + pw * 0.6, Y(level.goal.yours) - 2);

  const par = level.env.parasite;
  if (par) {
    ctx.fillStyle = P.warn;
    ctx.fillRect(X(par.from) - 0.5, padT, 1, ph);
  }
  if (switchedAt !== null) {
    ctx.fillStyle = P.muted;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(X(switchedAt) - 0.5, padT, 1, ph);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('tallying', X(switchedAt) + 4, padT);
  }

  const series: [keyof History, string, number][] = [['mutants', P.mut, 1.5], ['parasite', P.warn, 2], ['yours', P.accent, 2.5]];
  for (const [k, col, lw] of series) {
    const a = hist[k];
    if (!a.length || (k === 'parasite' && !par)) continue;
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    a.forEach((v, t) => (t ? ctx.lineTo(X(t + 1), Y(v)) : ctx.moveTo(X(t + 1), Y(v))));
    ctx.stroke();
    const t = a.length - 1;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(X(t + 1), Y(a[t]), 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
