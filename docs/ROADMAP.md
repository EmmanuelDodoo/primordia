# Roadmap

## Principle

Get the road to LUCA fun before building any branches. The risk for this project is breadth before the core loop works.

## Milestone 1: Campaign 1 done well (current)

- [x] Four RNA-world levels
- [x] Seeded engines, trials, regression tests
- [x] Hybrid engine; visual mode while populations are small
- [ ] Sampled agents after the switch (see ARCHITECTURE.md)
- [ ] Lab mode: unlocked after a level, environment sliders from `ENV_RANGES`, no pass/fail
- [ ] A level that needs **two** designs working together (for example, a replicase plus a separate catalyst). This is where reuse starts to feel like Turing Complete.

## Milestone 2: Road to LUCA

Rough level ideas, each a new rule plus a reason to reuse earlier designs:

- **Genetic code.** Sequences map to catalysts through a lookup the player designs.
- **Metabolism.** Turn an energy gradient (vents, sunlight) into building blocks instead of being fed.
- **Cell division.** Grow and split so both halves keep working.
- **Regulation.** Switch genes on and off as conditions change.
- **LUCA.** A capstone combining the above, tested across several environments.

## Milestone 3: The tree

Each era's environment follows Earth's history: no free oxygen early, the Great Oxidation Event (~2.4 Gya), Snowball Earth, the Cambrian.

Branching notes from the biology:

- **Bacteria and Archaea** split from LUCA.
- **Eukaryotes come from a merger**: an archaeal host plus a bacterial endosymbiont (the mitochondrion). The level should require combining one archaeal and one bacterial design from your library.
- **Plants come from a second merger**: a eukaryote plus a cyanobacterium (the chloroplast).
- **"Protists" is not one branch.** It is every eukaryote that isn't a plant, animal or fungus. The tree should show real lineages, not a protist bucket.
- **Multicellularity evolved many times** (animals, plants, fungi, several algae). That suggests a level type you can attempt from more than one branch.

## Open questions

- How much real biology versus invented rules? Current stance: real where it's cheap to be real, invented where it makes the puzzle work, and say which is which in-game.
- Tests are statistical. Is 3 of 5 trials the right bar, or should harder levels need more?
