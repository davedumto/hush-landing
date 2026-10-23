// The island scene (#mac): pure timeline math, ported from hush-update-kit/reference/src/scene.js.
// Every value here is a function of the pin progress p (0..1), so scrolling backward replays the scene
// in reverse and nothing can drift out of step. No DOM access in this file; see islandSceneDriver.ts.
// Coordinates are in the laptop screen's virtual 1280 x 800 space (the .screen-in canvas, scaled to fit).
// Do not round, retune or "improve" any number here: they are the reference's.

import { clamp, lerp } from "@/lib/journey";

/** island diameter, virtual px */
export const SI = 78;
export const VW = 1280;
export const VH = 800;

export type Pt = readonly [number, number];

// the five stops (top-left corner of the island)
export const L: Pt = [20, VH / 2 - SI / 2]; // left edge: (20, 361), where the headphones land
export const T: Pt = [VW / 2 - SI / 2, 42]; // under the notch: (601, 42)
export const R: Pt = [VW - SI - 20, VH / 2 - SI / 2]; // right edge: (1182, 361)
export const M: Pt = [VW / 2 - SI / 2, VH / 2 - SI / 2]; // middle: (601, 361)
export const BR: Pt = [VW * 0.8 - SI / 2, VH * 0.82 - SI / 2]; // bottom right: centre at (0.8 W, 0.82 H)

/** [from, to, start, end] in pin progress */
export const LEGS: readonly (readonly [Pt, Pt, number, number])[] = [
  [L, T, 0.26, 0.32],
  [T, R, 0.395, 0.455],
  [R, M, 0.53, 0.59],
  [M, BR, 0.665, 0.725],
  [BR, L, 0.8, 0.85],
];

/** the tray is open inside these windows: left edge, under the notch, right edge, middle, bottom right */
export const OPEN: readonly (readonly [number, number])[] = [
  [0.13, 0.25],
  [0.328, 0.387],
  [0.463, 0.522],
  [0.598, 0.657],
  [0.733, 0.792],
];

/** step copy starts (six steps) */
export const STEPS: readonly number[] = [0, 0.065, 0.12, 0.26, 0.53, 0.8];

/** mode story: ANC to start, Ambient at the left edge, TalkThru under the notch, back to ANC at the right edge */
export const MODES: readonly (readonly [number, string])[] = [
  [0, "anc"],
  [0.16, "amb"],
  [0.33, "talk"],
  [0.468, "anc"],
];

/** the island shows from here (until the flight starts) */
export const SHOW_AT = 0.06;
/** the island pulses inside this window */
export const PULSE: readonly [number, number] = [0.075, 0.125];
/** the cursor and position label show inside this window (and hide while the tray is open) */
export const DEMO: readonly [number, number] = [0.115, 0.855];
/** height of the upward drag arc, virtual px */
export const ARC = 30;
/** trail dots fade over this many ms */
export const TRAIL_MS = 700;

/** cubic ease in-out */
export const eio = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export type Dir = "down" | "up" | "left" | "right";
export type Cell = { h: 0 | 1 | 2; v: 0 | 1 | 2 };

/** which cell of the 3 x 3 grid the island's centre is in */
export function cell(x: number, y: number): Cell {
  const cx = x + SI / 2, cy = y + SI / 2;
  return { h: cx < VW / 3 ? 0 : cx > (VW * 2) / 3 ? 2 : 1, v: cy < VH / 3 ? 0 : cy > (VH * 2) / 3 ? 2 : 1 };
}

/** the app's 3 x 3 opening rule: top row and centre open down, middle left right, middle right left, bottom row up */
export function trayDir(x: number, y: number): Dir {
  const { h, v } = cell(x, y);
  return v === 0 || (v === 1 && h === 1) ? "down" : v === 2 ? "up" : h === 0 ? "right" : "left";
}

export const ARROW: Record<Dir, string> = { down: "↓", up: "↑", left: "←", right: "→" };
const NAMES = [
  ["Top left", "Under the notch", "Top right"],
  ["Left edge", "Middle", "Right edge"],
  ["Bottom left", "Bottom", "Bottom right"],
] as const;

export function cellName(x: number, y: number): string {
  const { h, v } = cell(x, y);
  return NAMES[v][h];
}

/** the position label's text, for example "Under the notch  ↓" */
export function labelText(x: number, y: number): string {
  return cellName(x, y) + "  " + ARROW[trayDir(x, y)];
}

/** true when the tray should use the row of 4 buttons (opening up or down); false for the 2 x 2 (sideways) */
export const isRow4 = (d: Dir) => d === "up" || d === "down";

export type Pos = { x: number; y: number; mv: boolean };

/** the island's position (top-left, virtual px); mv is true while a drag is strictly in progress */
export function posAt(p: number): Pos {
  for (const [a, b, s, e] of LEGS) {
    if (p < s) return { x: a[0], y: a[1], mv: false };
    if (p <= e) {
      const q = (p - s) / (e - s), k = eio(q);
      return { x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k) + Math.sin(Math.PI * k) * -ARC, mv: q > 0 && q < 1 };
    }
  }
  return { x: L[0], y: L[1], mv: false };
}

/** index of the step copy at p (0..5) */
export const stepAt = (p: number) => STEPS.reduce<number>((a, v, i) => (p >= v ? i : a), 0);

/** index of the tray window p is inside, or -1 */
export const openIndexAt = (p: number) => OPEN.findIndex(([a, b]) => p >= a && p <= b);

/** index into MODES for p */
export function modeIndexAt(p: number): number {
  let m = 0;
  MODES.forEach(([at], i) => {
    if (p >= at) m = i;
  });
  return m;
}

export type ModeAction =
  | { kind: "none" }
  /** crossing backward (or first frame, or a jump of more than one step): set the state directly */
  | { kind: "set"; mode: string }
  /** crossing exactly one threshold forward: show the previous mode, then run a real pick of the next one */
  | { kind: "pick"; from: string; to: string };

/** forward/backward aware mode story, like the reference's modes(p) */
export function modeAction(lastMode: number, m: number): ModeAction {
  if (m === lastMode) return { kind: "none" };
  const fwd = lastMode >= 0 && m === lastMode + 1;
  return fwd ? { kind: "pick", from: MODES[m - 1][1], to: MODES[m][1] } : { kind: "set", mode: MODES[m][1] };
}

/** the cursor presses (scales to 0.9) while dragging and just around each tray click */
export const cursorPress = (p: number, mv: boolean) => mv || OPEN.some(([a]) => p >= a - 0.006 && p < a + 0.004);

/** the cursor's top-left: it rides at 62 % across and 60 % down the island */
export const cursorAt = (x: number, y: number) => ({ x: x + SI * 0.62, y: y + SI * 0.6 });

/** the position label's top-left: under the island in the top half, above it in the bottom half */
export function labelAt(x: number, y: number, labelW: number) {
  const below = y < VH * 0.5;
  return { x: clamp(x + SI / 2 - labelW / 2, 8, VW - labelW - 8), y: below ? y + SI + 12 : y - 40 };
}

export type Size = { w: number; h: number };
export type TrayPlacement = { dir: Dir; x: number; y: number; orgX: number; orgY: number };

const OPP: Record<Dir, Dir> = { down: "up", up: "down", left: "right", right: "left" };

/**
 * Where the tray goes for an island at (x, y). It opens toward the free space (3 x 3 rule); if it does not fit
 * that way it flips to the opposite side, then clamps inside the screen (10 px margins, 40 px below the top so
 * it clears the menu bar). orgX/orgY is the transform origin (the island's centre) relative to the tray.
 * size(row4) returns the tray's layout size for that button layout. A flip never changes the axis, so the
 * button layout picked from the preferred direction is always the right one for the final direction too.
 */
export function placeTray(x: number, y: number, size: (row4: boolean) => Size): TrayPlacement {
  let d = trayDir(x, y);
  const { w: cw, h: ch } = size(isRow4(d));
  const cx = x + SI / 2, cy = y + SI / 2;
  const fits = (dd: Dir) =>
    ({ down: y + ch <= VH - 10, up: y + SI - ch >= 40, right: x + cw <= VW - 10, left: x + SI - cw >= 10 })[dd];
  if (!fits(d) && fits(OPP[d])) d = OPP[d];
  let tx = d === "right" ? x : d === "left" ? x + SI - cw : cx - cw / 2;
  let ty = d === "down" ? y : d === "up" ? y + SI - ch : cy - ch / 2;
  tx = clamp(tx, 10, VW - cw - 10);
  ty = clamp(ty, 40, VH - ch - 10);
  return { dir: d, x: tx, y: ty, orgX: cx - tx, orgY: cy - ty };
}

export type SceneFrame = {
  pos: Pos;
  step: number;
  modeIdx: number;
  /** the island is on screen (scaled in) */
  shown: boolean;
  pulse: boolean;
  /** the tray window for this frame, or -1 (always -1 when the island is not shown) */
  openIdx: number;
  /** inside the cursor/label window (they still hide while the tray is actually open) */
  demo: boolean;
  press: boolean;
};

/** everything about the scene that is a pure function of p and the flight progress */
export function sceneFrame(p: number, flight: number): SceneFrame {
  const pos = posAt(p);
  const shown = p > SHOW_AT && flight <= 0;
  return {
    pos,
    step: stepAt(p),
    modeIdx: modeIndexAt(p),
    shown,
    pulse: p > PULSE[0] && p < PULSE[1],
    openIdx: shown ? openIndexAt(p) : -1,
    demo: shown && p > DEMO[0] && p < DEMO[1],
    press: cursorPress(p, pos.mv),
  };
}

/** progress used when there are no pins (reduced motion): inside the left edge window, so the tray shows open there */
export const STATIC_P = 0.2;
