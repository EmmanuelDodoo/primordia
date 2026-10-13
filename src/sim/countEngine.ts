// Tally engine: each compartment is a map of sequence -> count. Fast at any
// population size, but strands have no identity or position.

import { analyze, mutate, BASES, type BaseCounts } from './chemistry';
import { binom, poisson, rng, type Rng } from './random';
import { breakdownChance, catalysis, copyRate, foodScale, fullFood, refill, saturation } from './kinetics';
import { capacity, classify, founders, type Census, type CompartmentView, type Engine, type RunSetup } from './engine';

export interface CountState {
  comps: Map<string, number>[];
  food: BaseCounts;
  t: number;
}

export class CountEngine implements Engine {
  readonly mode = 'counts' as const;
  private comps: Map<string, number>[];
  private foodPool: BaseCounts;
  private tick: number;
  private readonly cap: number;
  private readonly R: Rng;

  constructor(private readonly setup: RunSetup, from?: { state: CountState; rng: Rng }) {
    this.cap = capacity(setup);
    if (from) {
      this.comps = from.state.comps;
      this.foodPool = from.state.food;
      this.tick = from.state.t;
      this.R = from.rng;
    } else {
      this.comps = founders(setup).map((n) => new Map([[setup.design, n]]));
      this.foodPool = fullFood(setup.env);
      this.tick = 0;
      this.R = rng(setup.seed);
    }
  }

  get t(): number {
    return this.tick;
  }

  step(): void {
    const { env } = this.setup;
    const R = this.R;
    const food = this.foodPool;
    refill(env, food);

    // Breakdown returns bases to the pool.
    for (const m of this.comps) {
      for (const [seq, n] of m) {
        const a = analyze(seq);
        const d = binom(R, n, breakdownChance(env, a));
        if (!d) continue;
        for (const b of BASES) food[b] += a.composition[b] * d;
        if (n - d) m.set(seq, n - d);
        else m.delete(seq);
      }
    }

    // Plan copying.
    const sat = saturation(env, food);
    const plan: [number, string, number][] = [];
    const demand: BaseCounts = { A: 0, U: 0, G: 0, C: 0 };
    this.comps.forEach((m, ci) => {
      let cat = 0;
      for (const [seq, n] of m) if (analyze(seq).catalytic) cat += n;
      const boost = catalysis(env, cat);
      for (const [seq, n] of m) {
        const a = analyze(seq);
        const ev = poisson(R, n * copyRate(env, a, boost, sat));
        if (!ev) continue;
        plan.push([ci, seq, ev]);
        for (const b of BASES) demand[b] += a.composition[b] * ev;
      }
    });

    // Carry it out, limited by food.
    const scale = foodScale(env, food, demand);
    const par = env.parasite;
    for (const [ci, seq, planned] of plan) {
      const ev = scale < 1 ? binom(R, planned, scale) : planned;
      if (!ev) continue;
      const a = analyze(seq);
      const m = this.comps[ci];
      if (!env.unlimitedFood) for (const b of BASES) food[b] -= a.composition[b] * ev;
      let normal = ev;
      if (par && this.tick >= par.from && seq !== par.seq) {
        const pz = binom(R, ev, par.rate);
        if (pz) {
          m.set(par.seq, (m.get(par.seq) ?? 0) + pz);
          normal -= pz;
        }
      }
      const exact = binom(R, normal, a.pExact);
      m.set(seq, (m.get(seq) ?? 0) + exact);
      for (let k = 0; k < normal - exact; k++) {
        const ms = mutate(R, a);
        m.set(ms, (m.get(ms) ?? 0) + 1);
      }
    }
    for (const b of BASES) food[b] = Math.max(0, food[b]);

    // Full vesicles split; the daughter replaces a random other vesicle.
    if (this.cap < Infinity) {
      const N = this.comps.length;
      for (let ci = 0; ci < N; ci++) {
        let tot = 0;
        for (const n of this.comps[ci].values()) tot += n;
        if (tot < this.cap) continue;
        const keep = new Map<string, number>();
        const leave = new Map<string, number>();
        for (const [seq, n] of this.comps[ci]) {
          const k = binom(R, n, 0.5);
          if (k) keep.set(seq, k);
          if (n - k) leave.set(seq, n - k);
        }
        this.comps[ci] = keep;
        // With a single compartment this lands back on itself: it just halves.
        let tgt = (R() * N) | 0;
        if (tgt === ci) tgt = (tgt + 1) % N;
        this.comps[tgt] = leave;
      }
    }
    this.tick++;
  }

  census(): Census {
    const c: Census = { yours: 0, mutants: 0, parasite: 0, catalysts: 0, total: 0 };
    for (const m of this.comps)
      for (const [seq, n] of m) {
        c.total += n;
        const k = classify(seq, this.setup);
        if (k === 'yours') c.yours += n;
        else if (k === 'parasite') c.parasite += n;
        if (analyze(seq).catalytic) c.catalysts += n;
      }
    c.mutants = c.total - c.yours - c.parasite;
    return c;
  }

  compartments(): CompartmentView[] {
    return this.comps.map((m) => {
      const v: CompartmentView = { capacity: this.cap, yours: 0, mutants: 0, parasite: 0, total: 0 };
      for (const [seq, n] of m) {
        v.total += n;
        const k = classify(seq, this.setup);
        if (k === 'yours') v.yours += n;
        else if (k === 'parasite') v.parasite += n;
        else v.mutants += n;
      }
      return v;
    });
  }

  agents(): null {
    return null;
  }

  food(): Readonly<BaseCounts> {
    return this.foodPool;
  }
}
