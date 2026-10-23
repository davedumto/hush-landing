// The page island (#pisl): pure math for free drag, keyboard moves, saved position, menu placement and the
// one time tip, ported from hush-update-kit/reference/src/new-island.js (UPDATE_GUIDE.md section 1).
// No DOM access in this file; see pageIslandDriver.ts. Every position is the island's top-left corner in
// viewport px. Do not retune any number here: they are the reference's.

import { clamp } from "@/lib/journey";

/** viewport width at and above which the island docks at the left edge, vertically centred */
export const WIDE = 900;
/** gap kept between the island and every viewport edge (and below the nav) */
export const EDGE = 12;
/** gap kept between the menu and the viewport edges (and below the nav) */
export const MENU_EDGE = 8;
/** movement, in px, before a press becomes a drag; anything less is a click */
export const DRAG_PX = 6;
/** arrow key step, and the step with Shift held */
export const KEY_STEP = 24;
export const KEY_STEP_SHIFT = 96;
/** the tip's gap from the island, and how long it stays up */
export const TIP_GAP = 12;
export const TIP_MS = 5200;
/** after a drop, a click that arrives within this many ms belongs to the drag and must not open the menu */
export const CLICK_GUARD_MS = 60;
/** the drop sound */
export const DROP_SOUND = "confirm";
export const DROP_VOLUME = 0.35;
/** sizes to fall back on before layout (the 62 px desktop island, the 64 px nav) */
export const FALLBACK_SIZE = 62;
export const FALLBACK_NAV = 64;

export const POS_KEY = "hush-island";
export const TIP_KEY = "hush-island-tip";

export type Pos = { x: number; y: number };
export type Viewport = { w: number; h: number };
export type Size = { w: number; h: number };
export type Bounds = { x0: number; y0: number; x1: number; y1: number };

/** default spot: 20 px from the left and vertically centred from 900 px up; 16 px from the left and bottom below */
export function defaultPos(vp: Viewport, size: number): Pos {
  return vp.w < WIDE ? { x: 16, y: vp.h - size - 16 } : { x: 20, y: vp.h / 2 - size / 2 };
}

/** where the island may sit: 12 px inside every edge, and 12 px below the nav at the top */
export function islandBounds(vp: Viewport, size: number, navH: number): Bounds {
  return { x0: EDGE, y0: navH + EDGE, x1: vp.w - size - EDGE, y1: vp.h - size - EDGE };
}

/**
 * Clamp into the bounds. On a viewport too small to hold the island (x1 < x0 or y1 < y0) the low edge wins,
 * so the island stays below the nav and against the left edge rather than going off the top or left.
 */
export function clampPos(p: Pos, b: Bounds): Pos {
  return { x: clamp(p.x, b.x0, b.x1), y: clamp(p.y, b.y0, b.y1) };
}

/** true once a press has moved far enough (6 px, straight line) to count as a drag */
export const isDrag = (dx: number, dy: number) => Math.hypot(dx, dy) >= DRAG_PX;

/** how far an arrow key moves the island, or null for any other key */
export function keyDelta(key: string, shift: boolean): readonly [number, number] | null {
  const st = shift ? KEY_STEP_SHIFT : KEY_STEP;
  switch (key) {
    case "ArrowLeft":
      return [-st, 0];
    case "ArrowRight":
      return [st, 0];
    case "ArrowUp":
      return [0, -st];
    case "ArrowDown":
      return [0, st];
    default:
      return null;
  }
}

export type MenuPlacement = { x: number; y: number; orgX: number; orgY: number };

/**
 * Where the menu goes for an island at p. Horizontally it opens toward the free side: with the island's centre
 * in the left half its left edge lines up with the island's left edge, otherwise its right edge lines up with
 * the island's right edge. Vertically it is centred on the island. Both are clamped 8 px inside the viewport
 * and 8 px below the nav (when the menu is too big to fit, the top / left edge wins). orgX/orgY is the
 * transform origin (the island's centre) relative to the menu, so it grows out of the island.
 */
export function placeMenu(p: Pos, size: number, menu: Size, vp: Viewport, navH: number): MenuPlacement {
  const cx = p.x + size / 2, cy = p.y + size / 2;
  const top = navH + MENU_EDGE;
  const x = clamp(cx < vp.w / 2 ? p.x : p.x + size - menu.w, MENU_EDGE, vp.w - menu.w - MENU_EDGE);
  const y = clamp(cy - menu.h / 2, top, vp.h - menu.h - MENU_EDGE);
  return { x, y, orgX: cx - x, orgY: cy - y };
}

/** the tip's top-left: beside the island on the side with more room, vertically centred on it */
export function placeTip(p: Pos, size: number, tip: Size, vw: number): Pos {
  const right = p.x + size / 2 < vw / 2;
  return { x: right ? p.x + size + TIP_GAP : p.x - tip.w - TIP_GAP, y: p.y + size / 2 - tip.h / 2 };
}

// ---------- saved position: viewport fractions, so it survives a resize or another screen ----------

export type Fractions = { fx: number; fy: number };

export const toFractions = (p: Pos, vp: Viewport): Fractions => ({ fx: p.x / vp.w, fy: p.y / vp.h });
export const fromFractions = (f: Fractions, vp: Viewport): Pos => ({ x: f.fx * vp.w, y: f.fy * vp.h });

/** the slice of Storage used here */
export type StorageLike = Pick<Storage, "getItem" | "setItem">;
/**
 * Storage is passed as a getter, not a value: in some browsers (blocked site data, sandboxed frames) merely
 * touching window.localStorage throws, so the access itself must sit inside the try.
 */
export type GetStorage = () => StorageLike | null | undefined;

const isFrac = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** the saved fractions, or null if nothing valid is saved or storage is unavailable */
export function loadFractions(store: GetStorage): Fractions | null {
  try {
    const raw = store()?.getItem(POS_KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (v && typeof v === "object" && isFrac((v as Fractions).fx) && isFrac((v as Fractions).fy)) {
      return { fx: (v as Fractions).fx, fy: (v as Fractions).fy };
    }
  } catch {
    // storage blocked or the value is not JSON: fall back to the default spot
  }
  return null;
}

/** save p as viewport fractions; false if storage is unavailable */
export function saveFractions(store: GetStorage, p: Pos, vp: Viewport): boolean {
  if (!(vp.w > 0 && vp.h > 0)) return false;
  try {
    const s = store();
    if (!s) return false;
    s.setItem(POS_KEY, JSON.stringify(toFractions(p, vp)));
    return true;
  } catch {
    return false;
  }
}

/** the island's starting position: the saved spot if there is one, else the default, clamped either way */
export function initialPos(saved: Fractions | null, vp: Viewport, size: number, navH: number): Pos {
  const p = saved ? fromFractions(saved, vp) : defaultPos(vp, size);
  return clampPos(p, islandBounds(vp, size, navH));
}

/** true once the tip has been dismissed by a drag or keyboard move (storage unavailable reads as false) */
export function loadTipDone(store: GetStorage): boolean {
  try {
    return store()?.getItem(TIP_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveTipDone(store: GetStorage): boolean {
  try {
    const s = store();
    if (!s) return false;
    s.setItem(TIP_KEY, "1");
    return true;
  } catch {
    return false;
  }
}
