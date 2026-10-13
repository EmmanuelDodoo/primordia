# Primordia

A puzzle game about the origin of life, in the spirit of Turing Complete. Each level hands you an environment and a goal. You design a molecule (later: a cell, an organism) that thrives there. The game tests it, and solved designs go into a library you reuse in later levels.

Campaign 1 (RNA world) has four levels: self-copying strands, folding, ribozyme catalysis, and membranes against parasites.

## Run it

```bash
npm install
npm run dev        # local dev server with hot reload
npm test           # chemistry, engine and level regression tests
npm run build      # static site in dist/
```

## Deploy

Push to GitHub, then in the repo's Settings → Pages set **Source** to **GitHub Actions**. Every push to `main` runs the tests, builds, and publishes the game. The build uses relative paths, so `dist/` also works as an itch.io HTML upload.

## Layout

```
src/
  sim/        the simulation: chemistry, rate laws, engines (no DOM)
  levels/     level data, judging, trials
  game/       saved progress
  ui/         page wiring and canvas renderers
tests/        vitest suites, incl. a fixture of the original prototype
docs/         architecture and roadmap
```

`src/sim` and `src/levels` never touch the DOM, so they run in tests and could later run in a Web Worker or be replaced by a Rust/WASM core.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the engines work and [docs/ROADMAP.md](docs/ROADMAP.md) for where this is going.

The chemistry is simplified and partly invented. GNRA tetraloops are real; treating one as a copying catalyst is a game rule.
