# Architecture

## Layers

```
levels/campaign1.ts   what the player faces: environment + goal + text
        │
levels/judge.ts       runs trials, decides pass/fail
        │
sim/index.ts          createEngine(setup, 'hybrid' | 'counts' | 'agents')
        │
sim/kinetics.ts       rate laws (shared by every engine)
sim/chemistry.ts      what a sequence is: fold, catalysis, fidelity, speed
```

The UI (`src/ui`) reads engines only through the `Engine` interface in `sim/engine.ts`.

## Three engines, one set of rules

All "how fast does X happen" logic lives in `kinetics.ts`. Engines differ only in how they sample it.

| Engine | State | Good for | Cost |
|---|---|---|---|
| `CountEngine` | per compartment, a map of sequence → count | big populations, batch testing | flat in population size |
| `AgentEngine` | one object per strand with id, parent, position | watching, lineages, spatial rules later | grows with population |
| `HybridEngine` | agents until the pool passes `DEFAULT_AGENT_LIMIT` (600), then counts | the game | |

The switch is one-way. Tallies have no positions or lineages to rebuild agents from.

`tests/engines.test.ts` checks that:

- `CountEngine` reproduces the original single-file prototype exactly (`tests/fixtures/legacy-sim.cjs`), and
- `AgentEngine` agrees with `CountEngine` on average across seeds.

If you change a rule, change it in `kinetics.ts` or `chemistry.ts` so both engines pick it up. Then run `npm test`.

## Tick order

Every engine does the same steps each tick:

1. Refill food (`foodInflow`, capped at `foodMax`).
2. Breakdown: each strand may break down and return its bases.
3. Plan copies: Poisson draw per strand from `copyRate`, with catalysis counted per compartment.
4. Scale copying down if the plan needs more of a base than exists.
5. Make copies: parasite conversion, then exact copy or point mutation.
6. Divide full vesicles; the daughter replaces a random other vesicle.
7. (Agents only) drift.

## Randomness

Everything is seeded (`sim/random.ts`). A design always gets the same verdict, and any run can be replayed from `(level, design, vesicleSize, seed)`. `AgentEngine` uses a second stream for motion so drifting never changes the chemistry.

## Trials

A single run is noisy. Population outcomes spread widely from luck in the first few copies. So a design is judged like a Turing Complete test suite: `TRIALS.count` runs (5) with different seeds, and it must pass `TRIALS.needed` (3). The player watches trial 1; the rest run headless.

`tests/levels.test.ts` checks each level's reference solution passes on the real seeds *and* on other seed sets, so a level can't quietly depend on a lucky seed. It also checks the known-bad designs and the starter draft fail.

## Environment is data

`sim/environment.ts` defines `Environment` as plain numbers. Levels ship one; engines only read it. `ENV_RANGES` lists the sliders lab mode should expose. Lab mode is `cloneEnv(level.env)`, edited, passed to `setupFor`.

## Where the visual mode goes next

Today the pool view draws real agents while the hybrid is in agent mode: copies bud out of their parent with a tether, vesicles show their real contents. When the engine switches to tallies, open water falls back to a sampled dot cloud and vesicles become pies.

Next steps, roughly in order:

1. **Sampled agents after the switch.** Keep ~300 representative agents alive after switching (resampled from the tallies each tick) so the view doesn't change style mid-run.
2. **Zoom into one vesicle.** Click a vesicle to follow it with full agent detail, even when the rest are tallied.
3. **Draw strands as strands.** Short bead chains (hairpins folded) instead of dots when zoomed in, reusing `strandView`'s layout.
4. **Spatial chemistry.** Make catalysis local (strands near a ribozyme copy faster) in `AgentEngine`. This is where agent and count engines would stop being equivalent, so it needs its own rule flag and tests.
5. **Move the sim to a Web Worker** once runs get heavy, then consider Rust/WASM for the engine.
