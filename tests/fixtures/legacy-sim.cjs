// ===== Primordia game chemistry =====
const BASES = ['A', 'U', 'G', 'C'];
const PAIR = { A: 'U', U: 'A', G: 'C', C: 'G' };
const ERR = { A: 0.015, U: 0.015, G: 0.004, C: 0.004 };

function revcomp(s) { let r = ''; for (let i = s.length - 1; i >= 0; i--) r += PAIR[s[i]]; return r; }
function gcCount(s) { let n = 0; for (const c of s) if (c === 'G' || c === 'C') n++; return n; }

const _cache = new Map();
function analyze(seq) {
  if (_cache.has(seq)) return _cache.get(seq);
  const L = seq.length;
  const gcf = L ? gcCount(seq) / L : 0;
  let fold = null;
  for (let s = Math.min(8, Math.floor((L - 3) / 2)); s >= 3 && !fold; s--) {
    const cands = [];
    for (let i = 0; i + 2 * s + 3 <= L; i++) {
      const X = seq.substr(i, s);
      if (gcCount(X) < 2) continue;
      const rc = revcomp(X);
      for (let j = i + s + 3; j + s <= L && j - (i + s) <= 8; j++) {
        if (seq.substr(j, s) === rc) cands.push({ i, j, s, loop: seq.slice(i + s, j) });
      }
    }
    if (cands.length) fold = cands.find(c => /^G[AUGC][AG]A$/.test(c.loop)) || cands[0];
  }
  const catalytic = !!(fold && /^G[AUGC][AG]A$/.test(fold.loop));
  let pExact = 1; const errW = []; let errSum = 0;
  const comp = { A: 0, U: 0, G: 0, C: 0 };
  for (const c of seq) { pExact *= 1 - ERR[c]; errW.push(ERR[c]); errSum += ERR[c]; comp[c]++; }
  const sep = 1 - 0.8 * gcf * gcf;
  const speed = L ? (1 / L) * sep * (fold ? 0.35 : 1) : 0;
  const a = { seq, L, gcf, fold, catalytic, pExact, errW, errSum, comp, speed, sep };
  _cache.set(seq, a);
  return a;
}

function rng(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(R) { let u = 0, v = 0; while (u === 0) u = R(); v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function binom(R, n, p) {
  if (n <= 0 || p <= 0) return 0; if (p >= 1) return n;
  if (n < 40) { let k = 0; for (let i = 0; i < n; i++) if (R() < p) k++; return k; }
  const m = n * p, sd = Math.sqrt(n * p * (1 - p));
  return Math.max(0, Math.min(n, Math.round(m + sd * gauss(R))));
}
function poisson(R, lam) {
  if (lam <= 0) return 0;
  if (lam < 30) { const L = Math.exp(-lam); let k = 0, p = 1; do { k++; p *= R(); } while (p > L); return k - 1; }
  return Math.max(0, Math.round(lam + Math.sqrt(lam) * gauss(R)));
}

function mutate(R, a) {
  let x = R() * a.errSum, pos = 0;
  for (; pos < a.L - 1; pos++) { x -= a.errW[pos]; if (x <= 0) break; }
  const old = a.seq[pos]; let nb;
  do { nb = BASES[(R() * 4) | 0]; } while (nb === old);
  return a.seq.slice(0, pos) + nb + a.seq.slice(pos + 1);
}

// Levels
const LEVELS = [
  {
    id: 'copy', name: 'First Copy', era: 'Prebiotic pool, ~4.2 Gya',
    brief: 'A warm pool feeds in all four nucleotides at the same rate. Write a strand that copies itself well enough to fill the pool with exact copies.',
    rules: ['G·C pairs copy accurately but are hard to pull apart, so GC-rich strands copy slowly.', 'A·U pairs separate easily but cause more copying errors.', 'Each copy uses up the bases it contains. The pool only refills each base so fast.'],
    minLen: 8, maxLen: 16, ticks: 400,
    params: { k0: 0.9, decay: 0.012, foldDecay: 0.15, inflow: 6, Fmax: 400, Km: 40, B: 0, Kc: 50 },
    goal: { exact: 450 },
    goalText: 'At least 450 exact copies of your design when the run ends.',
  },
  {
    id: 'fold', name: 'Hydrolysis', era: 'UV-lit shallows',
    brief: 'Water and sunlight break strands apart quickly here. Loose strands fall apart before they can copy. A strand that folds back on itself into a hairpin is shielded.',
    rules: ['A hairpin forms when a stretch of 3+ bases is followed (after a loop of 3 to 8 bases) by its reverse complement.', 'The stem needs at least 2 G·C pairs to hold together.', 'Folded strands last about 7x longer, but copy about 3x slower because they must unfold first.'],
    minLen: 10, maxLen: 20, ticks: 400,
    params: { k0: 0.9, decay: 0.06, foldDecay: 0.15, inflow: 6, Fmax: 400, Km: 40, B: 0, Kc: 50 },
    goal: { exact: 100 },
    goalText: 'At least 100 exact copies of your design when the run ends.',
  },
  {
    id: 'ligase', name: 'Ligase', era: 'Cold clay flats',
    brief: 'Copying barely happens on its own here. You need a ribozyme: a folded strand whose loop acts as a catalyst and speeds up copying for every strand around it.',
    rules: ['A hairpin whose loop is exactly G-N-R-A is a catalyst (N is any base, R is A or G).', 'Catalysts speed up copying of all strands in the pool, including other species.', 'Everything from earlier levels still applies.'],
    minLen: 10, maxLen: 20, ticks: 400,
    params: { k0: 0.06, decay: 0.03, foldDecay: 0.15, inflow: 6, Fmax: 400, Km: 40, B: 30, Kc: 8 },
    goal: { exact: 250 },
    goalText: 'At least 250 exact copies of your design when the run ends.',
  },
  {
    id: 'cheat', name: 'Cheaters', era: 'Fatty-acid froth',
    brief: 'At tick 60 a short parasite strand shows up. It cannot catalyze anything, but it uses your ribozyme to copy itself very fast. In open water it wins. Wrap the chemistry in membranes so each vesicle keeps its own catalysts.',
    rules: ['Catalysts only help strands inside the same vesicle.', 'A vesicle splits in two when it holds as many strands as its size allows. Contents are divided at random.', 'Each new vesicle replaces a random existing one, so vesicles compete.'],
    minLen: 10, maxLen: 20, ticks: 500,
    params: { k0: 0.06, decay: 0.03, foldDecay: 0.15, inflow: 6, Fmax: 400, Km: 40, B: 30, Kc: 10 },
    parasite: 'GCUAGC', parasiteAt: 60, parasiteRate: 0.005,
    membrane: true, vesicles: 36, noFood: true, openCap: 1500,
    goal: { exact: 200, share: 0.45 },
    goalText: 'At least 200 exact copies of your design, making up at least 45% of all strands, when the run ends.',
  },
];

// state: { comps:[Map seq->count], food:{A,U,G,C}, t }
function initState(level, design, opts) {
  const P = level.params;
  const food = { A: P.Fmax, U: P.Fmax, G: P.Fmax, C: P.Fmax };
  let comps;
  const mem = level.membrane ? (opts && opts.membrane) : 0;
  if (level.membrane && mem) {
    comps = [];
    for (let v = 0; v < level.vesicles; v++) comps.push(new Map([[design, 3]]));
  } else {
    comps = [new Map([[design, 6]])];
  }
  return { comps, food, t: 0, cap: mem || (level.openCap || Infinity), design };
}

function step(level, S, R) {
  const P = level.params;
  for (const b of BASES) S.food[b] = Math.min(P.Fmax, S.food[b] + P.inflow);
  // deaths
  for (const m of S.comps) {
    for (const [seq, n] of m) {
      const a = analyze(seq);
      const d = binom(R, n, P.decay * (a.fold ? P.foldDecay : 1));
      if (d) { for (const b of BASES) S.food[b] += a.comp[b] * d; const k = n - d; if (k) m.set(seq, k); else m.delete(seq); }
    }
  }
  // replication demand
  const sat = {}; for (const b of BASES) sat[b] = level.noFood ? 1 : S.food[b] / (S.food[b] + P.Km);
  const plan = []; const demand = { A: 0, U: 0, G: 0, C: 0 };
  for (let ci = 0; ci < S.comps.length; ci++) {
    const m = S.comps[ci];
    let C = 0; for (const [seq, n] of m) if (analyze(seq).catalytic) C += n;
    const boost = 1 + P.B * C / (C + P.Kc);
    for (const [seq, n] of m) {
      const a = analyze(seq);
      let s = 1; for (const b of BASES) if (a.comp[b]) s = Math.min(s, sat[b]);
      const ev = poisson(R, n * P.k0 * boost * a.speed * s);
      if (ev) { plan.push([ci, seq, ev]); for (const b of BASES) demand[b] += a.comp[b] * ev; }
    }
  }
  let scale = 1; if (!level.noFood) for (const b of BASES) if (demand[b] > S.food[b]) scale = Math.min(scale, S.food[b] / demand[b]);
  for (const [ci, seq, ev0] of plan) {
    const ev = scale < 1 ? binom(R, ev0, scale) : ev0;
    if (!ev) continue;
    const a = analyze(seq); const m = S.comps[ci];
    if (!level.noFood) for (const b of BASES) S.food[b] -= a.comp[b] * ev;
    let ev2 = ev;
    if (level.parasite && S.t >= level.parasiteAt && seq !== level.parasite) {
      const pz = binom(R, ev, level.parasiteRate);
      if (pz) { m.set(level.parasite, (m.get(level.parasite) || 0) + pz); ev2 -= pz; }
    }
    const ex = binom(R, ev2, a.pExact);
    m.set(seq, (m.get(seq) || 0) + ex);
    for (let k = 0; k < ev2 - ex; k++) { const ms = mutate(R, a); m.set(ms, (m.get(ms) || 0) + 1); }
  }
  for (const b of BASES) S.food[b] = Math.max(0, S.food[b]);
  // division
  if (S.cap < Infinity) {
    const N = S.comps.length;
    for (let ci = 0; ci < N; ci++) {
      let tot = 0; for (const n of S.comps[ci].values()) tot += n;
      if (tot >= S.cap) {
        const A = new Map(), Bm = new Map();
        for (const [seq, n] of S.comps[ci]) { const k = binom(R, n, 0.5); if (k) A.set(seq, k); if (n - k) Bm.set(seq, n - k); }
        S.comps[ci] = A;
        let tgt = (R() * N) | 0; if (tgt === ci) tgt = (tgt + 1) % N;
        S.comps[tgt] = Bm;
      }
    }
  }
  S.t++;
}

function census(S, level) {
  let mine = 0, total = 0, par = 0, cat = 0;
  for (const m of S.comps) for (const [seq, n] of m) {
    total += n; if (seq === S.design) mine += n;
    if (level.parasite && seq === level.parasite) par += n;
    if (analyze(seq).catalytic) cat += n;
  }
  return { mine, total, par, cat, mut: total - mine - par };
}

function judge(level, c) {
  const g = level.goal;
  let ok = c.mine >= g.exact;
  if (g.share) ok = ok && c.total > 0 && c.mine / c.total >= g.share;
  return ok;
}

function validate(level, seq) {
  if (seq.length < level.minLen) return `Needs at least ${level.minLen} bases.`;
  if (seq.length > level.maxLen) return `At most ${level.maxLen} bases.`;
  return null;
}

if (typeof module !== 'undefined') module.exports = { LEVELS, analyze, initState, step, census, judge, rng };
