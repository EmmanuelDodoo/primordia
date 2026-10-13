// Agent engine: every strand is an object with an identity, a parent, and a
// position. Same rules as the count engine (see kinetics.ts), sampled one
// strand at a time. This is what the visual mode draws: copies appear next to
// the strand they came from, and lineages can be traced.
//
// Cost grows with population, so HybridEngine hands off to counts once the
// pool gets big.

import { analyze, mutate, BASES, type BaseCounts } from './chemistry';
import { binom, gauss, poisson, rng, type Rng } from './random';
import { breakdownChance, catalysis, copyRate, foodScale, fullFood, refill, saturation } from './kinetics';
import {
  capacity, classify, founders,
  type AgentView, type Census, type CompartmentView, type Engine, type RunSetup,
} from './engine';
import type { CountState } from './countEngine';

interface Agent extends AgentView {}

/** How far a strand drifts per tick, in compartment-local units. */
const DRIFT = 0.04;
/** How far from its parent a new copy appears. */
const SPAWN_OFFSET = 0.06;

export class AgentEngine implements Engine {
  readonly mode = 'agents' as const;
  private pop: Agent[] = [];
  private foodPool: BaseCounts;
  private tick = 0;
  private nextId = 0;
  private readonly cap: number;
  private readonly nComps: number;
  private readonly R: Rng;
  /** Motion has its own stream so drifting never changes the chemistry. */
  private readonly M: Rng;

  constructor(private readonly setup: RunSetup) {
    this.cap = capacity(setup);
    this.R = rng(setup.seed);
    this.M = rng(setup.seed ^ 0x9e3779b9);
    this.foodPool = fullFood(setup.env);
    const f = founders(setup);
    this.nComps = f.length;
    f.forEach((n, ci) => {
      for (let k = 0; k < n; k++) {
        const [x, y] = this.randomPoint();
        this.pop.push(this.make(setup.design, ci, x, y, -1));
      }
    });
  }

  get t(): number {
    return this.tick;
  }

  /** The chemistry RNG, so a handoff to the count engine continues the same stream. */
  get rng(): Rng {
    return this.R;
  }

  private open(): boolean {
    return this.setup.vesicles === 0;
  }

  private make(seq: string, compartment: number, x: number, y: number, parent: number): Agent {
    return { id: this.nextId++, seq, kind: classify(seq, this.setup), compartment, x, y, born: this.tick, parent };
  }

  private randomPoint(): [number, number] {
    const M = this.M;
    if (this.open()) return [M() * 2 - 1, M() * 2 - 1];
    const r = Math.sqrt(M()) * 0.85;
    const th = M() * Math.PI * 2;
    return [r * Math.cos(th), r * Math.sin(th)];
  }

  /** Keep a point inside the square (open water) or the unit disk (vesicle). */
  private confine(a: Agent): void {
    if (this.open()) {
      // Reflect off the walls so strands don't pile up in corners.
      if (a.x > 1) a.x = 2 - a.x;
      if (a.x < -1) a.x = -2 - a.x;
      if (a.y > 1) a.y = 2 - a.y;
      if (a.y < -1) a.y = -2 - a.y;
      a.x = Math.max(-1, Math.min(1, a.x));
      a.y = Math.max(-1, Math.min(1, a.y));
      return;
    }
    const r = Math.hypot(a.x, a.y);
    if (r > 0.92) {
      a.x *= 0.92 / r;
      a.y *= 0.92 / r;
    }
  }

  step(): void {
    const { env } = this.setup;
    const R = this.R;
    const food = this.foodPool;
    refill(env, food);

    // Breakdown.
    const alive: Agent[] = [];
    for (const ag of this.pop) {
      const a = analyze(ag.seq);
      if (R() < breakdownChance(env, a)) {
        for (const b of BASES) food[b] += a.composition[b];
      } else alive.push(ag);
    }
    this.pop = alive;

    // Plan copying.
    const sat = saturation(env, food);
    const cats = new Array(this.nComps).fill(0);
    for (const ag of this.pop) if (analyze(ag.seq).catalytic) cats[ag.compartment]++;
    const boosts = cats.map((c) => catalysis(env, c));
    const plan: [Agent, number][] = [];
    const demand: BaseCounts = { A: 0, U: 0, G: 0, C: 0 };
    for (const ag of this.pop) {
      const a = analyze(ag.seq);
      const ev = poisson(R, copyRate(env, a, boosts[ag.compartment], sat));
      if (!ev) continue;
      plan.push([ag, ev]);
      for (const b of BASES) demand[b] += a.composition[b] * ev;
    }

    // Carry it out. Each copy appears beside its parent.
    const scale = foodScale(env, food, demand);
    const par = env.parasite;
    const born: Agent[] = [];
    for (const [parent, planned] of plan) {
      const ev = scale < 1 ? binom(R, planned, scale) : planned;
      if (!ev) continue;
      const a = analyze(parent.seq);
      if (!env.unlimitedFood) for (const b of BASES) food[b] -= a.composition[b] * ev;
      for (let k = 0; k < ev; k++) {
        let seq: string;
        if (par && this.tick >= par.from && parent.seq !== par.seq && R() < par.rate) seq = par.seq;
        else seq = R() < a.pExact ? parent.seq : mutate(R, a);
        const th = this.M() * Math.PI * 2;
        const child = this.make(
          seq, parent.compartment,
          parent.x + Math.cos(th) * SPAWN_OFFSET, parent.y + Math.sin(th) * SPAWN_OFFSET,
          parent.id,
        );
        this.confine(child);
        born.push(child);
      }
    }
    for (const b of BASES) food[b] = Math.max(0, food[b]);
    for (const c of born) this.pop.push(c);

    this.divide();
    this.drift();
    this.tick++;
  }

  /** Full vesicles split; the daughter replaces a random other vesicle. */
  private divide(): void {
    if (this.cap === Infinity) return;
    const R = this.R;
    const N = this.nComps;
    const sizes = new Array(N).fill(0);
    for (const a of this.pop) sizes[a.compartment]++;
    for (let ci = 0; ci < N; ci++) {
      if (sizes[ci] < this.cap) continue;
      let tgt = (R() * N) | 0;
      if (tgt === ci) tgt = (tgt + 1) % N;
      const next: Agent[] = [];
      sizes.fill(0);
      for (const a of this.pop) {
        if (a.compartment === tgt && tgt !== ci) continue; // displaced
        if (a.compartment === ci && R() >= 0.5) {
          if (tgt === ci) continue; // single compartment: the leaving half is lost
          a.compartment = tgt;
          a.x = -a.x;
          a.y = -a.y;
        }
        sizes[a.compartment]++;
        next.push(a);
      }
      this.pop = next;
    }
  }

  private drift(): void {
    for (const a of this.pop) {
      a.x += gauss(this.M) * DRIFT;
      a.y += gauss(this.M) * DRIFT;
      this.confine(a);
    }
  }

  census(): Census {
    const c: Census = { yours: 0, mutants: 0, parasite: 0, catalysts: 0, total: this.pop.length };
    for (const a of this.pop) {
      if (a.kind === 'yours') c.yours++;
      else if (a.kind === 'parasite') c.parasite++;
      else c.mutants++;
      if (analyze(a.seq).catalytic) c.catalysts++;
    }
    return c;
  }

  compartments(): CompartmentView[] {
    const out: CompartmentView[] = Array.from({ length: this.nComps }, () => ({
      capacity: this.cap, yours: 0, mutants: 0, parasite: 0, total: 0,
    }));
    for (const a of this.pop) {
      const v = out[a.compartment];
      v.total++;
      if (a.kind === 'yours') v.yours++;
      else if (a.kind === 'parasite') v.parasite++;
      else v.mutants++;
    }
    return out;
  }

  agents(): readonly AgentView[] {
    return this.pop;
  }

  food(): Readonly<BaseCounts> {
    return this.foodPool;
  }

  /** Collapse individuals into tallies for the count engine. */
  toCounts(): CountState {
    const comps = Array.from({ length: this.nComps }, () => new Map<string, number>());
    for (const a of this.pop) comps[a.compartment].set(a.seq, (comps[a.compartment].get(a.seq) ?? 0) + 1);
    return { comps, food: { ...this.foodPool }, t: this.tick };
  }
}
