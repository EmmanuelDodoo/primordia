// Level regression suite. Change a rule or a number in the chemistry and this
// tells you which levels you just broke.

import { describe, expect, it } from 'vitest';
import { CAMPAIGN_1 } from '../src/levels/campaign1';
import { runTrials, validate } from '../src/levels/judge';

const ALT_BASES = [20000, 20131, 20262];

describe.each(CAMPAIGN_1.map((L) => [L.name, L] as const))('%s', (_, L) => {
  it('reference solution is a valid design', () => {
    expect(validate(L, L.reference.design)).toBeNull();
  });

  it('reference solution passes the real test', () => {
    const v = runTrials(L, L.reference.design, L.reference.vesicleSize ?? 0);
    expect(v.passed).toBe(true);
  });

  it('reference solution passes on other seeds too (not a lucky seed)', () => {
    const wins = ALT_BASES.filter((base) => runTrials(L, L.reference.design, L.reference.vesicleSize ?? 0, { base }).passed);
    expect(wins.length).toBeGreaterThanOrEqual(2);
  });

  it.each(L.shouldFail.map((c) => [`${c.design} @ ${c.vesicleSize ?? 0}`, c] as const))('%s fails', (_, c) => {
    expect(runTrials(L, c.design, c.vesicleSize ?? 0).passed).toBe(false);
  });

  it('starter draft fails, so the first run teaches something', () => {
    expect(runTrials(L, L.starter, 0).passed).toBe(false);
  });
});
