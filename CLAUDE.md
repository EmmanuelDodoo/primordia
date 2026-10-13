# Primordia: notes for Claude

Puzzle game about the origin of life (Turing Complete style). TypeScript + Vite, no framework, canvas rendering.

## Commands

- `npm test` runs all suites (~15s). Run after any change to `src/sim` or `src/levels`.
- `npm run typecheck`, `npm run build`, `npm run dev`.

## Rules of the codebase

- `src/sim` and `src/levels` must not touch the DOM.
- Rate laws live only in `src/sim/kinetics.ts`. Engines differ in sampling, never in rules.
- `CountEngine` must keep matching `tests/fixtures/legacy-sim.cjs` exactly. If a change is meant to alter outcomes, update the parity test deliberately and say so.
- Any change to chemistry or level numbers must keep `tests/levels.test.ts` green: reference solutions pass on several seed sets, known-bad designs and starters fail. Retune goals with a seed sweep, not one run.
- Level text is player-facing: plain sentences, no em dashes.
- Keep `docs/ARCHITECTURE.md` and `docs/ROADMAP.md` current when the design changes.
