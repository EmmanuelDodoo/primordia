// Wires the page together: level picker, strand builder, test runs.

import { analyze, createEngine, type Engine } from '../sim';
import { CAMPAIGN_1, ROADMAP } from '../levels/campaign1';
import { passes, runHeadless, setupFor, TRIALS, trialSeed, validate, verdict, type TrialResult } from '../levels/judge';
import type { Level } from '../levels/types';
import { Save } from '../game/progress';
import { drawStrand } from './strandView';
import { PoolView } from './poolView';
import { drawChart, emptyHistory, type History } from './chart';
import { HybridEngine } from '../sim/hybridEngine';

const LEVELS = CAMPAIGN_1;

/** Ticks simulated per animation frame. */
const SPEEDS = [
  { id: 'watch', label: 'Watch', ticksPerFrame: 0.25 },
  { id: 'normal', label: 'Normal', ticksPerFrame: 2 },
  { id: 'fast', label: 'Fast', ticksPerFrame: 12 },
] as const;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

interface ActiveRun {
  engine: Engine;
  level: Level;
  design: string;
  vesicleSize: number;
  raf: number;
  carry: number;
  cancelled: boolean;
}

export function startApp(): void {
  const save = new Save(LEVELS);
  let li = save.level;
  let vesicleSize = 0;
  let speed: (typeof SPEEDS)[number] = SPEEDS[1];
  let run: ActiveRun | null = null;
  let hist: History = emptyHistory();
  const pool = new PoolView($<HTMLCanvasElement>('pool'));

  const level = () => LEVELS[li];
  const seq = () => save.drafts[level().id] ?? '';
  const isOpen = () => !level().membrane || vesicleSize === 0;

  // ---------- Level picker and brief ----------
  function renderLevels() {
    const nav = $('levels');
    nav.innerHTML = '';
    LEVELS.forEach((L, i) => {
      const b = document.createElement('button');
      b.className = 'lv';
      b.disabled = i > save.progress.unlocked;
      b.setAttribute('aria-current', String(i === li));
      const solved = save.progress.solved[L.id];
      const tag = solved ? '✓ solved' : i > save.progress.unlocked ? 'locked' : '';
      b.innerHTML = `<span class="n"><span>0${i + 1}</span><span class="${solved ? 'ok' : ''}">${tag}</span></span><span class="t">${L.name}</span>`;
      b.onclick = () => {
        stopRun();
        li = i;
        vesicleSize = 0;
        save.setLevel(i);
        renderAll();
      };
      nav.appendChild(b);
    });
  }

  function renderBrief() {
    const L = level();
    $('brief').innerHTML = `<div class="eyebrow">Level ${li + 1} · ${L.era}</div><h2>${L.name}</h2><p>${L.brief}</p>
      <details class="rules" ${save.progress.solved[L.id] ? '' : 'open'}><summary>Chemistry rules</summary><ul>${L.rules.map((r) => `<li>${r}</li>`).join('')}</ul></details>
      <div class="goal"><b>Goal</b><span>${L.goalText} Your design must pass ${TRIALS.needed} of ${TRIALS.count} trial runs. Length ${L.minLen} to ${L.maxLen} bases.</span></div>`;
  }

  function renderRoadmap() {
    $('roadmap').innerHTML = ROADMAP.map((r, i) => {
      const built = i < LEVELS.length;
      const done = built && save.progress.solved[LEVELS[i].id];
      const tag = built ? '' : ' <span style="font-size:11px">· not built yet</span>';
      return `<li class="${done ? 'done' : ''}">${r}${done ? ' ✓' : ''}${tag}</li>`;
    }).join('');
  }

  // ---------- Strand builder ----------
  function setSeq(s: string) {
    save.setDraft(level().id, s);
    renderBench();
    clearResult();
  }

  function append(b: string) {
    if (run) return;
    const s = seq();
    if (s.length < level().maxLen) setSeq(s + b);
  }

  document.querySelectorAll<HTMLButtonElement>('.key[data-b]').forEach((k) => (k.onclick = () => append(k.dataset.b!)));
  $('back').onclick = () => !run && setSeq(seq().slice(0, -1));
  $('clear').onclick = () => !run && setSeq('');
  document.addEventListener('keydown', (e) => {
    if (run || e.metaKey || e.ctrlKey || e.altKey) return;
    if ((e.target as HTMLElement).closest('input, textarea')) return;
    const k = e.key.toUpperCase();
    if (k.length === 1 && 'AUGC'.includes(k)) append(k);
    else if (k === 'T') append('U');
    else if (e.key === 'Backspace' && e.target === document.body) {
      e.preventDefault();
      setSeq(seq().slice(0, -1));
    }
  });

  function renderStats() {
    const s = seq();
    $('seqtext').textContent = s ? `${s}  (${s.length})` : '';
    if (!s) {
      $('stats').innerHTML = '';
      $('valid').textContent = '';
      return;
    }
    const a = analyze(s);
    const items: [string, string, string?][] = [
      ['Length', s.length + ' nt'],
      ['G·C content', Math.round(a.gc * 100) + '%'],
      ['Exact copy', (a.pExact * 100).toFixed(1) + '%'],
      ['Copy speed', String(Math.round((a.speed / (1 / 8)) * 100))],
      ['Hairpin', a.fold ? `${a.fold.s}-bp stem` : 'no', a.fold ? 'yes' : 'no'],
      ['Catalyst', a.catalytic && a.fold ? 'GNRA ' + a.fold.loop : 'no', a.catalytic ? 'yes' : 'no'],
    ];
    $('stats').innerHTML = items.map(([k, v, c]) => `<div class="stat"><span class="k">${k}</span><span class="v ${c ?? ''}">${v}</span></div>`).join('');
    $('valid').textContent = validate(level(), s) ?? '';
  }

  function renderMembrane() {
    const L = level();
    const row = $('membraneRow');
    row.hidden = !L.membrane;
    if (!L.membrane) return;
    row.innerHTML = '<span class="lab">Vesicle size</span>' + L.membrane.sizes
      .map((m) => `<button class="chip" data-m="${m}" aria-pressed="${m === vesicleSize}">${m ? m + ' strands' : 'Open water'}</button>`)
      .join('');
    row.querySelectorAll<HTMLButtonElement>('.chip').forEach((c) => (c.onclick = () => {
      if (run) return;
      vesicleSize = Number(c.dataset.m);
      renderMembrane();
      clearResult();
    }));
  }

  function renderLibrary() {
    const row = $('library');
    const lib = LEVELS.filter((L) => save.progress.solved[L.id]).map((L) => [L.name, save.progress.solved[L.id]] as const);
    if (!lib.length) {
      row.innerHTML = '<span class="lab">Library</span><span class="lab">Solved designs land here for reuse.</span>';
      return;
    }
    row.innerHTML = '<span class="lab">Library</span>' + lib.map(([n, s]) => `<button class="chip" data-s="${s}" title="${n}">${s}</button>`).join('');
    row.querySelectorAll<HTMLButtonElement>('.chip').forEach((c) => (c.onclick = () => !run && setSeq(c.dataset.s!.slice(0, level().maxLen))));
  }

  function renderBench() {
    drawStrand($<HTMLCanvasElement>('strand'), seq());
    renderStats();
    renderMembrane();
    renderLibrary();
  }

  // ---------- Run view ----------
  function renderSpeeds() {
    const box = $('speeds');
    box.innerHTML = SPEEDS.map((s) => `<button class="chip" data-s="${s.id}" aria-pressed="${s === speed}">${s.label}</button>`).join('');
    box.querySelectorAll<HTMLButtonElement>('.chip').forEach((c) => (c.onclick = () => {
      speed = SPEEDS.find((s) => s.id === c.dataset.s)!;
      renderSpeeds();
    }));
  }

  function legend() {
    const items: [string, string][] = [['--accent', 'your design'], ['--mut', 'mutants']];
    if (level().env.parasite) items.push(['--warn', 'parasite']);
    $('legend').innerHTML = items.map(([c, t]) => `<span><i style="background:var(${c})"></i>${t}</span>`).join('');
  }

  function switchedAt(engine: Engine | null): number | null {
    return engine instanceof HybridEngine ? engine.switchedAt : null;
  }

  function drawRun() {
    const engine = run?.engine ?? null;
    pool.draw(engine, isOpen(), engine ? '' : 'Press Run test to seed the pool.');
    drawChart($<HTMLCanvasElement>('chart'), level(), hist, switchedAt(engine));
    const badge = $('mode');
    if (engine) {
      const c = engine.census();
      $('tick').textContent = `t ${engine.t}/${level().ticks} · yours ${c.yours} · all ${c.total}`;
      badge.hidden = false;
      badge.className = 'mode ' + engine.mode;
      badge.textContent = engine.mode === 'agents' ? '1 dot = 1 strand' : 'tallied';
    } else {
      $('tick').textContent = `tick 0 / ${level().ticks}`;
      badge.hidden = true;
    }
  }

  function drawIdle() {
    hist = emptyHistory();
    pool.reset();
    legend();
    drawRun();
  }

  function clearResult() {
    $('result').hidden = true;
    if (!run) drawIdle();
  }

  function lockInputs(locked: boolean) {
    document.querySelectorAll<HTMLButtonElement>('.key, #membraneRow .chip, #library .chip').forEach((b) => (b.disabled = locked));
  }

  $('go').onclick = () => {
    if (run) {
      stopRun();
      drawIdle();
    } else startRun();
  };

  function startRun() {
    const L = level();
    const s = seq();
    const err = validate(L, s);
    if (err) {
      $('valid').textContent = err;
      return;
    }
    clearResult();
    const size = L.membrane ? vesicleSize : 0;
    const engine = createEngine(setupFor(L, s, size, trialSeed(L, 0)), 'hybrid');
    hist = emptyHistory();
    pool.reset();
    run = { engine, level: L, design: s, vesicleSize: size, raf: 0, carry: 0, cancelled: false };
    $('go').textContent = 'Stop';
    $('runlabel').textContent = `Trial 1 of ${TRIALS.count}`;
    lockInputs(true);
    const active = run;
    const frame = () => {
      if (active.cancelled) return;
      active.carry += speed.ticksPerFrame;
      while (active.carry >= 1 && engine.t < L.ticks) {
        engine.step();
        const c = engine.census();
        hist.yours.push(c.yours);
        hist.mutants.push(c.mutants);
        hist.parasite.push(c.parasite);
        active.carry -= 1;
      }
      drawRun();
      if (engine.t >= L.ticks) {
        runRemainingTrials(active);
        return;
      }
      active.raf = requestAnimationFrame(frame);
    };
    active.raf = requestAnimationFrame(frame);
  }

  /** Trial 1 was watched. The rest run headless, one per timeout so the page stays responsive. */
  function runRemainingTrials(active: ActiveRun) {
    const first = active.engine.census();
    const results: TrialResult[] = [{ census: first, passed: passes(active.level, first) }];
    showTrials(results, true);
    const next = (k: number) => {
      if (active.cancelled) return;
      if (k >= TRIALS.count) {
        finish(active, results);
        return;
      }
      const r = runHeadless(active.level, active.design, active.vesicleSize, { seed: trialSeed(active.level, k) });
      results.push({ census: r.census, passed: r.passed });
      showTrials(results, true);
      setTimeout(() => next(k + 1), 0);
    };
    setTimeout(() => next(1), 30);
  }

  function trialChips(results: TrialResult[]): string {
    return Array.from({ length: TRIALS.count }, (_, k) => {
      const r = results[k];
      if (!r) return `<span class="trial wait">T${k + 1} …</span>`;
      return `<span class="trial ${r.passed ? 'ok' : 'no'}" title="${r.census.yours} of yours, ${r.census.total} total">T${k + 1} ${r.census.yours}</span>`;
    }).join('');
  }

  function showTrials(results: TrialResult[], pending: boolean) {
    const box = $('result');
    box.hidden = false;
    box.className = 'result';
    box.innerHTML = `<h4>${pending ? 'Checking trials…' : ''}</h4><div class="trials">${trialChips(results)}</div>`;
  }

  function stopRun() {
    if (run) {
      run.cancelled = true;
      cancelAnimationFrame(run.raf);
    }
    run = null;
    $('go').textContent = 'Run test';
    $('runlabel').textContent = 'Test run';
    lockInputs(false);
  }

  function finish(active: ActiveRun, results: TrialResult[]) {
    const L = active.level;
    const v = verdict(results);
    const watched = results[0].census;
    stopRun();
    // Keep the finished trial on screen.
    pool.draw(active.engine, isOpen(), '', true);
    drawChart($<HTMLCanvasElement>('chart'), L, hist, switchedAt(active.engine));

    let next = '';
    if (v.passed) {
      const nextIdx = li + 1 < LEVELS.length ? li + 1 : li;
      save.solve(L.id, active.design, nextIdx);
      // Level 4 starts from the ribozyme you just built.
      if (li + 1 === 3 && save.drafts[LEVELS[3].id] === LEVELS[3].starter) save.setDraft(LEVELS[3].id, active.design);
      next = li + 1 < LEVELS.length
        ? `<button class="go next" id="nextBtn">Next: ${LEVELS[li + 1].name}</button>`
        : '<p><b>Campaign 1 complete.</b> The next eras on the map are not built yet.</p>';
    }
    const tips = v.passed
      ? [L.winText]
      : L.diagnose({ census: watched, design: analyze(active.design), vesicleSize: active.vesicleSize });
    if (!v.passed && !tips.length) {
      tips.push(`Trial 1 reached ${watched.yours} of ${L.goal.yours} exact copies. Trials vary because copying and breakdown are random, so aim above the goal.`);
    }
    const box = $('result');
    box.hidden = false;
    box.className = 'result ' + (v.passed ? 'pass' : 'fail');
    box.innerHTML = `<h4>${v.passed ? 'Test passed' : 'Test failed'}</h4>
      <p>Passed ${v.passedCount} of ${TRIALS.count} trials (need ${TRIALS.needed}).</p>
      <div class="trials">${trialChips(results)}</div>
      ${tips.map((t) => `<p>${t}</p>`).join('')}${next}`;
    if (v.passed) {
      renderLevels();
      renderRoadmap();
      renderLibrary();
      const nb = document.getElementById('nextBtn');
      if (nb) nb.onclick = () => {
        li++;
        vesicleSize = 0;
        save.setLevel(li);
        renderAll();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    }
  }

  $('unlockAll').onclick = () => {
    save.unlockAll(LEVELS.length - 1);
    renderLevels();
  };

  function renderAll() {
    renderLevels();
    renderBrief();
    renderBench();
    renderRoadmap();
    renderSpeeds();
    $('result').hidden = true;
    $('runlabel').textContent = 'Test run';
    drawIdle();
  }

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      drawStrand($<HTMLCanvasElement>('strand'), seq());
      if (!run) drawRun();
    }, 120);
  });
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    drawStrand($<HTMLCanvasElement>('strand'), seq());
    if (!run) drawRun();
  });

  renderAll();
  document.fonts?.ready.then(() => {
    drawStrand($<HTMLCanvasElement>('strand'), seq());
    if (!run) drawRun();
  });
}
