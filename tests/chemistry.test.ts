import { describe, expect, it } from 'vitest';
import { analyze, findHairpin, mutate, rng } from '../src/sim';

describe('chemistry', () => {
  it('finds a hairpin and prefers a GNRA loop', () => {
    const h = findHairpin('GGCGAAAGCCAU');
    expect(h).not.toBeNull();
    expect(h!.loop).toBe('GAAA');
    expect(analyze('GGCGAAAGCCAU').catalytic).toBe(true);
  });

  it('needs two G·C pairs in the stem to fold', () => {
    expect(findHairpin('AAUGAAAAUU')).toBeNull();
  });

  it('a non-GNRA loop folds but does not catalyze', () => {
    const a = analyze('GGCAAAAGCC');
    expect(a.fold).not.toBeNull();
    expect(a.catalytic).toBe(false);
  });

  it('A·U strands copy less faithfully than G·C strands', () => {
    expect(analyze('AUAUAUAU').pExact).toBeLessThan(analyze('GCGCGCGC').pExact);
  });

  it('G·C strands copy more slowly', () => {
    expect(analyze('GCGCGCGC').speed).toBeLessThan(analyze('AUAUAUAU').speed);
  });

  it('a mutation changes exactly one base', () => {
    const R = rng(1);
    const a = analyze('AUGCAUGCAU');
    for (let k = 0; k < 50; k++) {
      const m = mutate(R, a);
      const diff = [...m].filter((c, i) => c !== a.seq[i]).length;
      expect(diff).toBe(1);
    }
  });
});
