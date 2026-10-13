import { analyze, createEngine, isSequence, type Census, type EngineKind, type RunSetup } from '../sim';
import type { Level } from './types';

export function validate(level: Level, seq: string): string | null {
  if (!isSequence(seq)) return 'Use only A, U, G and C.';
  if (seq.length < level.minLen) return `Needs at least ${level.minLen} bases.`;
  if (seq.length > level.maxLen) return `At most ${level.maxLen} bases.`;
  return null;
}

export function passes(level: Level, c: Census): boolean {
  const g = level.goal;
  if (c.yours < g.yours) return false;
  if (g.share !== undefined && (c.total === 0 || c.yours / c.total < g.share)) return false;
  return true;
}

export function setupFor(level: Level, design: string, vesicleSize = 0, seed = level.seed): RunSetup {
  const useMembrane = !!level.membrane && vesicleSize > 0;
  return {
    env: level.env,
    design,
    vesicles: useMembrane ? level.membrane!.vesicles : 0,
    vesicleSize: useMembrane ? vesicleSize : 0,
    seed,
  };
}

/** Run a level to the end without rendering. Used by tests and future batch tools. */
export function runHeadless(level: Level, design: string, vesicleSize = 0, opts: { seed?: number; engine?: EngineKind } = {}) {
  const engine = createEngine(setupFor(level, design, vesicleSize, opts.seed ?? level.seed), opts.engine);
  for (let t = 0; t < level.ticks; t++) engine.step();
  const census = engine.census();
  return { census, passed: passes(level, census), analysis: analyze(design) };
}

/** Like Turing Complete's test cases: a design is checked against several runs. */
export const TRIALS = { count: 5, needed: 3 };

export function trialSeed(level: Level, k: number, base = level.seed): number {
  return base + k * 7919;
}

export interface TrialResult {
  census: Census;
  passed: boolean;
}

export interface Verdict {
  trials: TrialResult[];
  passedCount: number;
  passed: boolean;
}

export function verdict(trials: TrialResult[]): Verdict {
  const passedCount = trials.filter((t) => t.passed).length;
  return { trials, passedCount, passed: passedCount >= TRIALS.needed };
}

/** Run every trial headless. `base` lets tests check a design against other seed sets. */
export function runTrials(level: Level, design: string, vesicleSize = 0, opts: { base?: number; engine?: EngineKind } = {}): Verdict {
  const trials = Array.from({ length: TRIALS.count }, (_, k) => {
    const r = runHeadless(level, design, vesicleSize, { seed: trialSeed(level, k, opts.base), engine: opts.engine });
    return { census: r.census, passed: r.passed };
  });
  return verdict(trials);
}
