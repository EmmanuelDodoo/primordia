// Rate laws shared by every engine. If two engines disagree on outcomes, the
// cause should be in how they sample, never in different rules. Keep all
// "how fast does X happen" logic here.

import { BASES, type Analysis, type BaseCounts } from './chemistry';
import type { Environment } from './environment';

export function fullFood(env: Environment): BaseCounts {
  return { A: env.foodMax, U: env.foodMax, G: env.foodMax, C: env.foodMax };
}

export function refill(env: Environment, food: BaseCounts): void {
  for (const b of BASES) food[b] = Math.min(env.foodMax, food[b] + env.foodInflow);
}

/** Chance per tick that a strand breaks down. */
export function breakdownChance(env: Environment, a: Analysis): number {
  return env.decay * (a.fold ? env.foldProtection : 1);
}

/** Multiplier on copy speed from catalysts sharing a compartment. */
export function catalysis(env: Environment, catalysts: number): number {
  return 1 + (env.catalystBoost * catalysts) / (catalysts + env.catalystHalfSat);
}

/** How available each base is, 0 to 1. */
export function saturation(env: Environment, food: BaseCounts): BaseCounts {
  const s = { A: 1, U: 1, G: 1, C: 1 };
  if (env.unlimitedFood) return s;
  for (const b of BASES) s[b] = food[b] / (food[b] + env.foodHalfSat);
  return s;
}

/** Expected copies per strand per tick. Limited by the scarcest base the strand uses. */
export function copyRate(env: Environment, a: Analysis, boost: number, sat: BaseCounts): number {
  let s = 1;
  for (const b of BASES) if (a.composition[b]) s = Math.min(s, sat[b]);
  return env.copyRate * boost * a.speed * s;
}

/** If planned copies need more of a base than the pool has, scale all copying down. */
export function foodScale(env: Environment, food: BaseCounts, demand: BaseCounts): number {
  if (env.unlimitedFood) return 1;
  let scale = 1;
  for (const b of BASES) if (demand[b] > food[b]) scale = Math.min(scale, food[b] / demand[b]);
  return scale;
}
