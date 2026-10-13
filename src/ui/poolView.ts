// The pool, drawn from engine state.
//
// While the engine tracks individuals, every dot is a real strand: new copies
// bud out of the strand they came from, with a short tether back to the parent.
// Once the engine switches to tallies, open water falls back to a sampled dot
// cloud and vesicles become pie charts.

import type { AgentView, Engine, StrandKind } from '../sim';
import { rng } from '../sim';
import { fitCanvas, palette, type Palette } from './theme';

interface Shown {
  x: number;
  y: number;
}

/** Ticks a new copy keeps its tether and halo. */
const NEWBORN_TICKS = 8;
/** How quickly displayed dots catch up with simulated positions (0 to 1, per frame). */
const EASE = 0.22;
const SAMPLE_DOTS = 260;

export class PoolView {
  private shown = new Map<number, Shown>();
  private sample: { x: number; y: number; vx: number; vy: number }[] = [];
  private ease = EASE;

  constructor(private readonly cv: HTMLCanvasElement) {}

  reset(): void {
    this.shown.clear();
  }

  draw(engine: Engine | null, open: boolean, idleText = '', snap = false): void {
    this.ease = snap ? 1 : EASE;
    const { ctx, w, h } = fitCanvas(this.cv);
    const P = palette();
    ctx.clearRect(0, 0, w, h);
    if (!engine) {
      this.drawSample(ctx, w, h, P, null);
      if (idleText) {
        ctx.fillStyle = P.muted;
        ctx.font = `13px ${P.bodyFont}`;
        ctx.textAlign = 'center';
        ctx.fillText(idleText, w / 2, h / 2);
      }
      return;
    }
    const agents = engine.agents();
    if (open) {
      if (agents) this.drawAgents(ctx, agents, engine.t, P, (a) => this.openPoint(a, w, h), agents.length > 400 ? 2.2 : 3);
      else this.drawSample(ctx, w, h, P, engine);
      return;
    }
    const comps = engine.compartments();
    const grid = this.grid(comps.length, w, h);
    for (let k = 0; k < comps.length; k++) {
      const [cx, cy] = grid.center(k);
      ctx.strokeStyle = P.line;
      ctx.lineWidth = 1;
      ctx.setLineDash(comps[k].total ? [] : [3, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, grid.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (agents) {
      this.drawAgents(ctx, agents, engine.t, P, (a) => {
        const [cx, cy] = grid.center(a.compartment);
        return [cx + a.x * grid.r, cy + a.y * grid.r];
      }, 1.8);
      return;
    }
    // Tallies: one pie per vesicle, area tracks how full it is.
    comps.forEach((v, k) => {
      if (!v.total) return;
      const [cx, cy] = grid.center(k);
      const r = Math.max(4, grid.r * Math.sqrt(Math.min(1, v.total / v.capacity)));
      let ang = -Math.PI / 2;
      for (const [n, col] of [[v.yours, P.accent], [v.mutants, P.mut], [v.parasite, P.warn]] as [number, string][]) {
        if (!n) continue;
        const da = (n / v.total) * Math.PI * 2;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, ang, ang + da);
        ctx.closePath();
        ctx.fill();
        ang += da;
      }
    });
  }

  /** Pick the column count that gives the largest vesicles. */
  private grid(n: number, w: number, h: number) {
    let best = { cols: 1, r: 0 };
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const r = Math.min(w / cols, h / rows) / 2;
      if (r > best.r + 0.5) best = { cols, r };
    }
    const cols = best.cols;
    const rows = Math.ceil(n / cols);
    const cw = w / cols;
    const ch = h / rows;
    return {
      r: Math.min(cw, ch) / 2 - 4,
      center: (k: number): [number, number] => [((k % cols) + 0.5) * cw, (Math.floor(k / cols) + 0.5) * ch],
    };
  }

  private openPoint(a: AgentView, w: number, h: number): [number, number] {
    const pad = 8;
    return [pad + ((a.x + 1) / 2) * (w - 2 * pad), pad + ((a.y + 1) / 2) * (h - 2 * pad)];
  }

  private color(kind: StrandKind, P: Palette): string {
    return kind === 'yours' ? P.accent : kind === 'parasite' ? P.warn : P.mut;
  }

  private drawAgents(
    ctx: CanvasRenderingContext2D, agents: readonly AgentView[], t: number, P: Palette,
    place: (a: AgentView) => [number, number], radius: number,
  ): void {
    const next = new Map<number, Shown>();
    // Ease displayed positions toward simulated ones. A new copy starts on its
    // parent, so it visibly buds off.
    for (const a of agents) {
      const [tx, ty] = place(a);
      const prev = this.shown.get(a.id) ?? this.shown.get(a.parent) ?? next.get(a.parent) ?? { x: tx, y: ty };
      next.set(a.id, { x: prev.x + (tx - prev.x) * this.ease, y: prev.y + (ty - prev.y) * this.ease });
    }
    this.shown = next;

    ctx.lineWidth = 1;
    for (const a of agents) {
      const age = t - a.born;
      if (age > NEWBORN_TICKS) continue;
      const me = next.get(a.id)!;
      const fade = 1 - age / NEWBORN_TICKS;
      const pa = agents.find((b) => b.id === a.parent);
      const parent = pa && pa.compartment === a.compartment ? next.get(a.parent) : undefined;
      ctx.globalAlpha = 0.5 * fade;
      ctx.strokeStyle = this.color(a.kind, P);
      if (parent) {
        ctx.beginPath();
        ctx.moveTo(parent.x, parent.y);
        ctx.lineTo(me.x, me.y);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(me.x, me.y, radius + 2 + 3 * (1 - fade), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Mutants and parasites first so your strands sit on top.
    for (const pass of ['mutant', 'parasite', 'yours'] as StrandKind[]) {
      ctx.fillStyle = this.color(pass, P);
      for (const a of agents) {
        if (a.kind !== pass) continue;
        const me = next.get(a.id)!;
        ctx.beginPath();
        ctx.arc(me.x, me.y, pass === 'yours' ? radius + 0.4 : radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** Count mode in open water: a fixed cloud of dots recolored to match the tallies. */
  private drawSample(ctx: CanvasRenderingContext2D, w: number, h: number, P: Palette, engine: Engine | null): void {
    if (this.sample.length === 0 || (this.sample as unknown as { w: number }).w !== w) {
      const R = rng(99);
      this.sample = Array.from({ length: SAMPLE_DOTS }, () => ({
        x: R() * w, y: R() * h, vx: (R() - 0.5) * 0.6, vy: (R() - 0.5) * 0.6,
      }));
      (this.sample as unknown as { w: number }).w = w;
    }
    const c = engine?.census();
    const total = c?.total ?? 0;
    const vis = Math.min(SAMPLE_DOTS, total);
    const nYours = total ? Math.round((vis * c!.yours) / total) : 0;
    const nPar = total ? Math.round((vis * c!.parasite) / total) : 0;
    this.sample.forEach((p, k) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 4 || p.x > w - 4) p.vx *= -1;
      if (p.y < 4 || p.y > h - 4) p.vy *= -1;
      if (k >= vis) return;
      ctx.fillStyle = k < nYours ? P.accent : k < nYours + nPar ? P.warn : P.mut;
      ctx.beginPath();
      ctx.arc(p.x, p.y, k < nYours ? 3.4 : 2.8, 0, Math.PI * 2);
      ctx.fill();
    });
    if (total > SAMPLE_DOTS) {
      ctx.fillStyle = P.muted;
      ctx.font = `11px ${P.monoFont}`;
      ctx.textAlign = 'right';
      ctx.fillText(`1 dot ≈ ${(total / SAMPLE_DOTS).toFixed(1)} strands`, w - 8, h - 8);
    }
  }
}
