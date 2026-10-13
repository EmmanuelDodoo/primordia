// Starts with individually tracked strands (so you can watch the first copies
// form) and switches to tallies once the population passes a threshold.
// The switch is one-way: tallies have no positions to rebuild agents from.

import { AgentEngine } from './agentEngine';
import { CountEngine } from './countEngine';
import type { Engine, RunSetup } from './engine';

export const DEFAULT_AGENT_LIMIT = 600;

export class HybridEngine implements Engine {
  private inner: AgentEngine | CountEngine;
  /** Tick at which the engine switched to counts, or null if it has not. */
  switchedAt: number | null = null;

  constructor(private readonly setup: RunSetup, private readonly agentLimit = DEFAULT_AGENT_LIMIT) {
    this.inner = new AgentEngine(setup);
  }

  get mode(): 'agents' | 'counts' {
    return this.inner.mode;
  }

  get t(): number {
    return this.inner.t;
  }

  step(): void {
    this.inner.step();
    const inner = this.inner;
    if (inner instanceof AgentEngine && inner.census().total > this.agentLimit) {
      this.inner = new CountEngine(this.setup, { state: inner.toCounts(), rng: inner.rng });
      this.switchedAt = inner.t;
    }
  }

  census() {
    return this.inner.census();
  }

  compartments() {
    return this.inner.compartments();
  }

  agents() {
    return this.inner.agents();
  }

  food() {
    return this.inner.food();
  }
}
