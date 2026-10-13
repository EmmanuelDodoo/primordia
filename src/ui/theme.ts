// Canvas drawing reads colors from the CSS tokens so both themes work.

import type { Base } from '../sim';

export function css(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export interface Palette {
  ink: string; muted: string; line: string; panel: string;
  accent: string; warn: string; mut: string;
  bodyFont: string; monoFont: string;
  base: Record<Base, string>;
}

/** Read once per frame, not once per draw call. */
export function palette(): Palette {
  return {
    ink: css('--ink'), muted: css('--muted'), line: css('--line'), panel: css('--panel'),
    accent: css('--accent'), warn: css('--warn'), mut: css('--mut'),
    bodyFont: css('--f-body'), monoFont: css('--f-mono'),
    base: { A: css('--base-a'), U: css('--base-u'), G: css('--base-g'), C: css('--base-c') },
  };
}

/** Match the canvas backing store to its CSS size and device pixel ratio. */
export function fitCanvas(cv: HTMLCanvasElement, cssHeight?: number) {
  const dpr = window.devicePixelRatio || 1;
  if (cssHeight) cv.style.height = cssHeight + 'px';
  const w = cv.clientWidth;
  const h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }
  const ctx = cv.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}
