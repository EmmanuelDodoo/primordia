// Seeded randomness. Every run is reproducible from its seed, which is what
// makes level tests (and "replay this run") possible.

export type Rng = () => number;

/** mulberry32: small, fast, good enough for game simulation. */
export function rng(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(R: Rng): number {
  let u = 0;
  while (u === 0) u = R();
  const v = R();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Number of successes in n trials with probability p. Normal approximation for large n. */
export function binom(R: Rng, n: number, p: number): number {
  if (n <= 0 || p <= 0) return 0;
  if (p >= 1) return n;
  if (n < 40) {
    let k = 0;
    for (let i = 0; i < n; i++) if (R() < p) k++;
    return k;
  }
  const m = n * p;
  const sd = Math.sqrt(n * p * (1 - p));
  return Math.max(0, Math.min(n, Math.round(m + sd * gauss(R))));
}

/** Number of events in a tick given an expected count lam. */
export function poisson(R: Rng, lam: number): number {
  if (lam <= 0) return 0;
  if (lam < 30) {
    const L = Math.exp(-lam);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= R();
    } while (p > L);
    return k - 1;
  }
  return Math.max(0, Math.round(lam + Math.sqrt(lam) * gauss(R)));
}
