// The environment is plain data. Levels ship one; lab mode will let the player
// edit a copy of it. Engines read it, never mutate it.

export interface ParasiteRule {
  /** Sequence of the cheater strand. */
  seq: string;
  /** Tick it starts appearing. */
  from: number;
  /** Chance each copy of another strand comes out as the parasite instead. */
  rate: number;
}

export interface Environment {
  /** Base copy rate, before strand speed and catalysis. */
  copyRate: number;
  /** Chance per tick an unfolded strand breaks down. */
  decay: number;
  /** Multiplier on decay for folded strands (lower is more protective). */
  foldProtection: number;
  /** Units of each free base added per tick. */
  foodInflow: number;
  /** Most of each base the pool can hold. */
  foodMax: number;
  /** Food level at which copying runs at half speed. */
  foodHalfSat: number;
  /** If true, food is unlimited (the level is about something else). */
  unlimitedFood: boolean;
  /** Max extra copy speed from catalysts (0 means catalysts do nothing). */
  catalystBoost: number;
  /** Catalyst count giving half the max boost. */
  catalystHalfSat: number;
  /** Strand cap for open water (no membranes). Infinity for none. */
  openWaterCap: number;
  parasite: ParasiteRule | null;
}

/** Sliders lab mode can expose, with sane ranges. */
export const ENV_RANGES: Partial<Record<keyof Environment, { min: number; max: number; step: number; label: string }>> = {
  copyRate: { min: 0.01, max: 2, step: 0.01, label: 'Copy rate' },
  decay: { min: 0, max: 0.2, step: 0.002, label: 'Breakdown (UV, hydrolysis)' },
  foldProtection: { min: 0.02, max: 1, step: 0.01, label: 'Fold protection' },
  foodInflow: { min: 0, max: 30, step: 1, label: 'Food inflow' },
  catalystBoost: { min: 0, max: 60, step: 1, label: 'Catalyst strength' },
};

export function cloneEnv(env: Environment): Environment {
  return { ...env, parasite: env.parasite ? { ...env.parasite } : null };
}
