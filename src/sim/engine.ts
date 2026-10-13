// The contract every simulation engine meets. The UI and the level judge only
// talk to this interface, so engines can be swapped (or switched mid-run).

import type { BaseCounts } from './chemistry';
import type { Environment } from './environment';

export interface RunSetup {
  env: Environment;
  /** The player's strand. */
  design: string;
  /** Number of vesicles, or 0 for open water. */
  vesicles: number;
  /** Strands a vesicle holds before it splits. Ignored in open water. */
  vesicleSize: number;
  seed: number;
}

export interface Census {
  yours: number;
  mutants: number;
  parasite: number;
  catalysts: number;
  total: number;
}

export interface CompartmentView {
  capacity: number;
  yours: number;
  mutants: number;
  parasite: number;
  total: number;
}

export type StrandKind = 'yours' | 'mutant' | 'parasite';

/** One individually tracked strand. Coordinates are local to its compartment, in [-1, 1]. */
export interface AgentView {
  id: number;
  seq: string;
  kind: StrandKind;
  compartment: number;
  x: number;
  y: number;
  /** Tick it was made. */
  born: number;
  /** id of the strand it was copied from, or -1 for the founders. */
  parent: number;
}

export interface Engine {
  /** 'agents' when strands are tracked one by one, 'counts' when tallied. */
  readonly mode: 'agents' | 'counts';
  readonly t: number;
  step(): void;
  census(): Census;
  compartments(): CompartmentView[];
  /** Individual strands, or null when the engine only keeps counts. */
  agents(): readonly AgentView[] | null;
  food(): Readonly<BaseCounts>;
}

export function classify(seq: string, setup: RunSetup): StrandKind {
  if (seq === setup.design) return 'yours';
  if (setup.env.parasite && seq === setup.env.parasite.seq) return 'parasite';
  return 'mutant';
}

/** Founding population, shared so engines start identically. */
export function founders(setup: RunSetup): number[] {
  return setup.vesicles > 0 ? Array(setup.vesicles).fill(3) : [6];
}

export function capacity(setup: RunSetup): number {
  return setup.vesicles > 0 ? setup.vesicleSize : setup.env.openWaterCap;
}
