// Saved progress, kept in the browser. Same keys as the prototype, so anyone
// who played the artifact version keeps their progress when it is hosted at
// the same origin (it won't carry over between different sites).

import type { Level } from '../levels/types';

const PREFIX = 'primordia:';

function get<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function set(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage blocked: progress just won't persist */
  }
}

export interface Progress {
  /** Index of the furthest unlocked level. */
  unlocked: number;
  /** Level id -> the design that solved it. */
  solved: Record<string, string>;
}

export class Save {
  progress: Progress;
  drafts: Record<string, string>;
  level: number;

  constructor(levels: Level[]) {
    this.progress = get<Progress>('progress', { unlocked: 0, solved: {} });
    const starters = Object.fromEntries(levels.map((l) => [l.id, l.starter]));
    this.drafts = { ...starters, ...get<Record<string, string>>('drafts', {}) };
    this.level = Math.min(get('level', 0), this.progress.unlocked, levels.length - 1);
  }

  setDraft(levelId: string, seq: string): void {
    this.drafts[levelId] = seq;
    set('drafts', this.drafts);
  }

  setLevel(i: number): void {
    this.level = i;
    set('level', i);
  }

  solve(levelId: string, design: string, unlockUpTo: number): void {
    this.progress.solved[levelId] = design;
    this.progress.unlocked = Math.max(this.progress.unlocked, unlockUpTo);
    set('progress', this.progress);
  }

  unlockAll(last: number): void {
    this.progress.unlocked = last;
    set('progress', this.progress);
  }
}
