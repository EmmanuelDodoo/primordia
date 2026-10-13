import type { Analysis, Census, Environment } from '../sim';

export interface Goal {
  /** Exact copies of the player's design needed at the end. */
  yours: number;
  /** Optional minimum fraction of all strands that must be yours. */
  share?: number;
}

export interface DiagnoseContext {
  census: Census;
  design: Analysis;
  vesicleSize: number;
}

export interface Level {
  id: string;
  name: string;
  /** Where and when this takes place. */
  era: string;
  brief: string;
  rules: string[];
  minLen: number;
  maxLen: number;
  ticks: number;
  env: Environment;
  /** Present when the player can wrap the chemistry in vesicles. */
  membrane: { vesicles: number; sizes: number[] } | null;
  goal: Goal;
  goalText: string;
  /** Seed for the test run, so a design always gets the same verdict. */
  seed: number;
  /** Draft shown before the player edits anything. Intentionally fails. */
  starter: string;
  /** A known solution. The test suite checks it passes. */
  reference: { design: string; vesicleSize?: number };
  /** Designs that should fail. The test suite checks they do. */
  shouldFail: { design: string; vesicleSize?: number }[];
  winText: string;
  /** Plain-language hints after a failed run. */
  diagnose(ctx: DiagnoseContext): string[];
}
