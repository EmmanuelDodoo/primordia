// The game's artificial chemistry: what a sequence *is* (folds, catalysis,
// copying fidelity, speed). Pure functions of the sequence, cached.
// Nothing here knows about time, populations or the environment.

import type { Rng } from './random';

export type Base = 'A' | 'U' | 'G' | 'C';
export const BASES: readonly Base[] = ['A', 'U', 'G', 'C'];
export type BaseCounts = Record<Base, number>;

const PAIR: Record<Base, Base> = { A: 'U', U: 'A', G: 'C', C: 'G' };

/** Per-base chance that copying this position goes wrong. G·C pairs are more faithful. */
export const COPY_ERROR: Record<Base, number> = { A: 0.015, U: 0.015, G: 0.004, C: 0.004 };

/** Hairpin loop that acts as a catalyst: G, any, purine, A. */
const GNRA = /^G[AUGC][AG]A$/;

export interface Hairpin {
  /** Start of the 5' arm of the stem. */
  i: number;
  /** Start of the 3' arm of the stem. */
  j: number;
  /** Stem length in base pairs. */
  s: number;
  loop: string;
}

export interface Analysis {
  seq: string;
  length: number;
  /** Fraction of G and C. */
  gc: number;
  fold: Hairpin | null;
  catalytic: boolean;
  /** Probability a copy has zero errors. */
  pExact: number;
  /** Per-position error weights, used to pick where a mutation lands. */
  errWeights: number[];
  errSum: number;
  composition: BaseCounts;
  /** Relative copy speed before environment and catalysis. */
  speed: number;
}

function revcomp(s: string): string {
  let r = '';
  for (let i = s.length - 1; i >= 0; i--) r += PAIR[s[i] as Base];
  return r;
}

function gcCount(s: string): number {
  let n = 0;
  for (const c of s) if (c === 'G' || c === 'C') n++;
  return n;
}

export function isSequence(s: string): boolean {
  return /^[AUGC]*$/.test(s);
}

/** Longest hairpin: stem of 3 to 8 bp with 2+ G·C pairs, loop of 3 to 8. Prefers a GNRA loop. */
export function findHairpin(seq: string): Hairpin | null {
  const L = seq.length;
  for (let s = Math.min(8, Math.floor((L - 3) / 2)); s >= 3; s--) {
    const cands: Hairpin[] = [];
    for (let i = 0; i + 2 * s + 3 <= L; i++) {
      const arm = seq.substr(i, s);
      if (gcCount(arm) < 2) continue;
      const rc = revcomp(arm);
      for (let j = i + s + 3; j + s <= L && j - (i + s) <= 8; j++) {
        if (seq.substr(j, s) === rc) cands.push({ i, j, s, loop: seq.slice(i + s, j) });
      }
    }
    if (cands.length) return cands.find((c) => GNRA.test(c.loop)) ?? cands[0];
  }
  return null;
}

const cache = new Map<string, Analysis>();

export function analyze(seq: string): Analysis {
  const hit = cache.get(seq);
  if (hit) return hit;
  const length = seq.length;
  const gc = length ? gcCount(seq) / length : 0;
  const fold = findHairpin(seq);
  const catalytic = !!(fold && GNRA.test(fold.loop));
  let pExact = 1;
  let errSum = 0;
  const errWeights: number[] = [];
  const composition: BaseCounts = { A: 0, U: 0, G: 0, C: 0 };
  for (const c of seq as Iterable<Base>) {
    pExact *= 1 - COPY_ERROR[c];
    errWeights.push(COPY_ERROR[c]);
    errSum += COPY_ERROR[c];
    composition[c]++;
  }
  // G·C-rich duplexes are harder to separate; folded strands must unfold first.
  const separation = 1 - 0.8 * gc * gc;
  const speed = length ? (1 / length) * separation * (fold ? 0.35 : 1) : 0;
  const a: Analysis = { seq, length, gc, fold, catalytic, pExact, errWeights, errSum, composition, speed };
  cache.set(seq, a);
  return a;
}

/** A single point mutation, landing preferentially on error-prone bases. */
export function mutate(R: Rng, a: Analysis): string {
  let x = R() * a.errSum;
  let pos = 0;
  for (; pos < a.length - 1; pos++) {
    x -= a.errWeights[pos];
    if (x <= 0) break;
  }
  const old = a.seq[pos];
  let nb: Base;
  do nb = BASES[(R() * 4) | 0];
  while (nb === old);
  return a.seq.slice(0, pos) + nb + a.seq.slice(pos + 1);
}
