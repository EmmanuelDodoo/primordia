// Campaign 1: RNA world. From a bare self-copying strand to protocells.

import type { Environment } from '../sim';
import type { Level } from './types';

const BASE_ENV: Environment = {
  copyRate: 0.9,
  decay: 0.012,
  foldProtection: 0.15,
  foodInflow: 6,
  foodMax: 400,
  foodHalfSat: 40,
  unlimitedFood: false,
  catalystBoost: 0,
  catalystHalfSat: 50,
  openWaterCap: Infinity,
  parasite: null,
};

const pct = (x: number) => Math.round(x * 100) + '%';

export const CAMPAIGN_1: Level[] = [
  {
    id: 'copy',
    name: 'First Copy',
    era: 'Prebiotic pool, ~4.2 Gya',
    brief:
      'A warm pool feeds in all four nucleotides at the same rate. Write a strand that copies itself well enough to fill the pool with exact copies.',
    rules: [
      'G·C pairs copy accurately but are hard to pull apart, so GC-rich strands copy slowly.',
      'A·U pairs separate easily but cause more copying errors.',
      'Each copy uses up the bases it contains. The pool only refills each base so fast.',
    ],
    minLen: 8, maxLen: 16, ticks: 400, seed: 101,
    env: { ...BASE_ENV },
    membrane: null,
    goal: { yours: 450 },
    goalText: 'At least 450 exact copies of your design when the run ends.',
    starter: 'AUAUAUAUAU',
    reference: { design: 'AUGCAUGC' },
    shouldFail: [{ design: 'AUAUAUAUAU' }, { design: 'GGGGCCCC' }],
    winText: 'A balanced strand draws on all four food streams and copies cleanly. Template copying alone is the seed of heredity.',
    diagnose({ census: c, design: a }) {
      const tips: string[] = [];
      if (a.gc >= 0.75) tips.push('Your strand is G·C heavy. It copies accurately but separates slowly, and it only eats G and C, so half the food goes unused.');
      else if (a.gc <= 0.25) tips.push('Your strand is almost all A and U. It only draws on half the food supply, and A·U pairs make sloppy copies.');
      if (c.mutants > c.yours) tips.push(`Mutants (${c.mutants}) outnumber exact copies. Shorter strands make fewer errors.`);
      return tips;
    },
  },
  {
    id: 'fold',
    name: 'Hydrolysis',
    era: 'UV-lit shallows',
    brief:
      'Water and sunlight break strands apart quickly here. Loose strands fall apart before they can copy. A strand that folds back on itself into a hairpin is shielded.',
    rules: [
      'A hairpin forms when a stretch of 3+ bases is followed (after a loop of 3 to 8 bases) by its reverse complement.',
      'The stem needs at least 2 G·C pairs to hold together.',
      'Folded strands last about 7x longer, but copy about 3x slower because they must unfold first.',
    ],
    minLen: 10, maxLen: 20, ticks: 400, seed: 118,
    env: { ...BASE_ENV, decay: 0.06 },
    membrane: null,
    goal: { yours: 100 },
    goalText: 'At least 100 exact copies of your design when the run ends.',
    starter: 'AUGCAUGCAU',
    reference: { design: 'GCGUUUCGCA' },
    shouldFail: [{ design: 'AUGCAUGCAU' }, { design: 'AUAUAUAUAUAU' }],
    winText: 'Folding trades copy speed for survival. Structure and information now live in the same molecule.',
    diagnose({ census: c, design: a }) {
      if (!a.fold) return ['Loose strands break down here faster than they copy. Make the strand fold: a stretch of 3+ bases, a loop of 3 to 8, then the reverse complement of that stretch.'];
      if (c.yours < 100) return ['It folds, which helps. Try a shorter, tighter hairpin so it copies faster.'];
      return [];
    },
  },
  {
    id: 'ligase',
    name: 'Ligase',
    era: 'Cold clay flats',
    brief:
      'Copying barely happens on its own here. You need a ribozyme: a folded strand whose loop acts as a catalyst and speeds up copying for every strand around it.',
    rules: [
      'A hairpin whose loop is exactly G-N-R-A is a catalyst (N is any base, R is A or G).',
      'Catalysts speed up copying of all strands in the pool, including other species.',
      'Everything from earlier levels still applies.',
    ],
    minLen: 10, maxLen: 20, ticks: 400, seed: 135,
    env: { ...BASE_ENV, copyRate: 0.06, decay: 0.03, catalystBoost: 30, catalystHalfSat: 8 },
    membrane: null,
    goal: { yours: 200 },
    goalText: 'At least 200 exact copies of your design when the run ends.',
    starter: 'GGCAAAAGCC',
    reference: { design: 'AGCGAAAGCUAA' },
    shouldFail: [{ design: 'GGCAAAAGCC' }],
    winText: 'Your ribozyme speeds up copying for every strand nearby. That generosity is a weakness, as the next level shows.',
    diagnose({ design: a }) {
      if (a.catalytic) return [];
      return [a.fold
        ? `Your hairpin's loop is ${a.fold.loop}. Only a 4-base loop of the form G-N-R-A catalyzes copying.`
        : 'Without a folded catalyst, copying is too slow to outrun breakdown.'];
    },
  },
  {
    id: 'cheat',
    name: 'Cheaters',
    era: 'Fatty-acid froth',
    brief:
      'From tick 60, copying errors start producing a short parasite strand. It cannot catalyze anything, but it uses your ribozyme to copy itself very fast. In open water it wins. Wrap the chemistry in membranes so each vesicle keeps its own catalysts.',
    rules: [
      'Catalysts only help strands inside the same vesicle.',
      'A vesicle splits in two when it holds as many strands as its size allows. Contents are divided at random.',
      'Each new vesicle replaces a random existing one, so vesicles compete.',
    ],
    minLen: 10, maxLen: 20, ticks: 500, seed: 152,
    env: {
      ...BASE_ENV, copyRate: 0.06, decay: 0.03, catalystBoost: 30, catalystHalfSat: 10,
      unlimitedFood: true, openWaterCap: 1500,
      parasite: { seq: 'GCUAGC', from: 60, rate: 0.005 },
    },
    membrane: { vesicles: 36, sizes: [0, 8, 20, 50, 150] },
    goal: { yours: 150, share: 0.38 },
    goalText: 'At least 150 exact copies of your design, making up at least 38% of all strands, when the run ends.',
    starter: 'GGCGAAAGCCAU',
    reference: { design: 'GGCGAAAGCCAU', vesicleSize: 20 },
    shouldFail: [
      { design: 'GGCGAAAGCCAU', vesicleSize: 0 },
      { design: 'GGCGAAAGCCAU', vesicleSize: 8 },
      { design: 'GGCGAAAGCCAU', vesicleSize: 50 },
      { design: 'GGCGAAAGCCAU', vesicleSize: 150 },
    ],
    winText: 'Small compartments keep the benefit of your catalyst close to the genes that make it. This is group selection, and the first step toward a cell.',
    diagnose({ census: c, design: a, vesicleSize }) {
      if (!a.catalytic) return ['Your strand needs to be a ribozyme (GNRA hairpin) or nothing copies.'];
      if (!vesicleSize) return ['In open water the parasite out-copies your ribozyme until no catalysts are left, then everything stalls. Add membranes.'];
      if (c.total && c.parasite / c.total > 0.15) return [`Parasites made up ${pct(c.parasite / c.total)} of strands. Large vesicles give them time to take over before the vesicle splits.`];
      if (c.total < 150 / 0.38) return [`Only ${c.total} strands fit across all vesicles. Tiny vesicles stay clean but can't hold enough copies.`];
      return [];
    },
  },
];

/** Future eras, shown on the campaign map. */
export const ROADMAP = [
  'Self-copying strand', 'Folding for stability', 'Ribozyme catalysis', 'Membranes vs cheaters',
  'Genetic code', 'Metabolism', 'Cell division', 'LUCA',
];
