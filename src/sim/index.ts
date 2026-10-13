export * from './chemistry';
export * from './random';
export * from './environment';
export * from './kinetics';
export * from './engine';
export { CountEngine, type CountState } from './countEngine';
export { AgentEngine } from './agentEngine';
export { HybridEngine, DEFAULT_AGENT_LIMIT } from './hybridEngine';

import { AgentEngine } from './agentEngine';
import { CountEngine } from './countEngine';
import { HybridEngine } from './hybridEngine';
import type { Engine, RunSetup } from './engine';

export type EngineKind = 'hybrid' | 'counts' | 'agents';

export function createEngine(setup: RunSetup, kind: EngineKind = 'hybrid'): Engine {
  if (kind === 'counts') return new CountEngine(setup);
  if (kind === 'agents') return new AgentEngine(setup);
  return new HybridEngine(setup);
}
