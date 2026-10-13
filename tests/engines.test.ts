import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { CAMPAIGN_1 } from '../src/levels/campaign1';
import { runHeadless, setupFor } from '../src/levels/judge';
import { AgentEngine, HybridEngine } from '../src/sim';

// The single-file prototype, kept so the count engine can be checked against it.
const legacy = createRequire(import.meta.url)('./fixtures/legacy-sim.cjs');

describe('count engine', () => {
  it('reproduces the original prototype exactly', () => {
    const cases: [number, string, number][] = [
      [0, 'AUGCAUGC', 0], [0, 'GGGGCCCC', 0], [1, 'GCGUUUCGCA', 0],
      [2, 'AGCGAAAGCUAA', 0], [3, 'GGCGAAAGCCAU', 20], [3, 'GGCGAAAGCCAU', 0],
    ];
    for (const [li, design, size] of cases) {
      const L = CAMPAIGN_1[li];
      const LL = legacy.LEVELS[li];
      const S = legacy.initState(LL, design, { membrane: size });
      const R = legacy.rng(L.seed);
      for (let t = 0; t < LL.ticks; t++) legacy.step(LL, S, R);
      const old = legacy.census(S, LL);
      const now = runHeadless(L, design, size, { engine: 'counts' }).census;
      expect([now.yours, now.total, now.parasite]).toEqual([old.mine, old.total, old.par]);
    }
  });
});

describe('agent engine', () => {
  it('agrees with the count engine on average', () => {
    const L = CAMPAIGN_1[0];
    const mean = (engine: 'agents' | 'counts') => {
      let sum = 0;
      for (let s = 0; s < 16; s++) sum += runHeadless(L, 'AUGCAUGC', 0, { engine, seed: 3000 + s }).census.yours;
      return sum / 16;
    };
    const a = mean('agents');
    const c = mean('counts');
    expect(Math.abs(a - c) / c).toBeLessThan(0.15);
  });

  it('places each copy beside the strand it came from', () => {
    const L = CAMPAIGN_1[0];
    const e = new AgentEngine(setupFor(L, 'AUGCAUGC'));
    for (let t = 0; t < 30; t++) e.step();
    const byId = new Map(e.agents().map((a) => [a.id, a]));
    let checked = 0;
    for (const a of e.agents()) {
      const p = byId.get(a.parent);
      if (!p || a.born !== e.t - 1) continue;
      expect(Math.hypot(a.x - p.x, a.y - p.y)).toBeLessThan(0.4);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('is deterministic for a given seed', () => {
    const L = CAMPAIGN_1[3];
    const a = runHeadless(L, 'GGCGAAAGCCAU', 20, { engine: 'agents' }).census;
    const b = runHeadless(L, 'GGCGAAAGCCAU', 20, { engine: 'agents' }).census;
    expect(a).toEqual(b);
  });
});

describe('hybrid engine', () => {
  it('tracks individuals while small and switches to counts when large', () => {
    const L = CAMPAIGN_1[0];
    const e = new HybridEngine(setupFor(L, 'AUGCAUGC'), 200);
    expect(e.mode).toBe('agents');
    expect(e.agents()).not.toBeNull();
    while (e.mode === 'agents' && e.t < L.ticks) e.step();
    expect(e.mode).toBe('counts');
    expect(e.switchedAt).not.toBeNull();
    expect(e.agents()).toBeNull();
    const before = e.census().total;
    expect(before).toBeGreaterThan(200);
    e.step();
    expect(e.census().total).toBeGreaterThan(0);
  });
});
