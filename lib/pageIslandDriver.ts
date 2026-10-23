// The page island's DOM driver: applies the pure math in pageIsland.ts to #pisl, #pmenu and #itip.
// Ported from hush-update-kit/reference/src/new-island.js with one change that keeps every handler free of
// layout reads after writes: the island's natural size, the nav's height, and the menu's and tip's layout
// sizes are read up front by measure() (init, resize, fonts ready), never inside a pointer, key or tick
// handler. The handlers themselves only write.
// Position is applied through the --px/--py custom properties, consumed by a translate3d() rule in
// globals.css; never through top/left.

import {
  CLICK_GUARD_MS,
  DROP_SOUND,
  DROP_VOLUME,
  FALLBACK_NAV,
  FALLBACK_SIZE,
  TIP_MS,
  clampPos,
  initialPos,
  isDrag,
  islandBounds,
  keyDelta,
  loadFractions,
  loadTipDone,
  placeMenu as menuPlacement,
  placeTip,
  saveFractions,
  saveTipDone,
  type GetStorage,
  type Pos,
  type Size,
  type Viewport,
} from "@/lib/pageIsland";

export type PageIslandNodes = {
  /** the page island button */
  pisl: HTMLButtonElement;
  /** its menu */
  pmenu: HTMLDivElement;
  /** the one time "Drag me anywhere" pill */
  itip: HTMLElement;
  /** the nav, whose bottom is the island's and menu's top limit */
  nav: HTMLElement | null;
};

export type PageIslandHooks = {
  /** sound, only through lib/audio's play() (it already no-ops while sound is off) */
  play: (k: string, v: number) => void;
  /** a drag just started: close the menu if it is open */
  onDragStart: () => void;
  /** the viewport's size (innerWidth / innerHeight) */
  viewport: () => Viewport;
  /** a clock in ms (performance.now) */
  now: () => number;
  /** localStorage, as a getter (see GetStorage) */
  storage: GetStorage;
};

/** the subset of a PointerEvent the drag uses */
export type PointerLike = { clientX: number; clientY: number; button: number; pointerId: number };
/** the subset of a KeyboardEvent the keyboard move uses */
export type KeyLike = { key: string; shiftKey: boolean; preventDefault: () => void };

export function createPageIsland(nodes: PageIslandNodes, hooks: PageIslandHooks) {
  const { pisl, pmenu, itip, nav } = nodes;

  let vp: Viewport = { w: 0, h: 0 };
  let size = FALLBACK_SIZE;
  let navH = FALLBACK_NAV;
  let menuSize: Size = { w: 0, h: 0 };
  let tipSize: Size = { w: 0, h: 0 };
  let pos: Pos = { x: 0, y: 0 };

  let drag: { sx: number; sy: number; ox: number; oy: number; moved: boolean } | null = null;
  let lastDropAt = -Infinity;

  let tipShown = false;
  let tipOn = false;
  let tipDone = false;
  let tipTimer: ReturnType<typeof setTimeout> | null = null;

  const hidden = () => pisl.classList.contains("hide");
  const menuOpen = () => pmenu.classList.contains("open");

  /** layout reads: call outside any write phase (on init, resize and fonts ready) */
  function measure() {
    vp = hooks.viewport();
    // offsetWidth is the layout size, untouched by the 0.4 hide scale or the 1.12 drag scale
    size = pisl.offsetWidth || FALLBACK_SIZE;
    navH = nav ? nav.offsetHeight : FALLBACK_NAV;
    menuSize = { w: pmenu.offsetWidth, h: pmenu.offsetHeight };
    tipSize = { w: itip.offsetWidth, h: itip.offsetHeight };
  }

  function apply() {
    pisl.style.setProperty("--px", pos.x + "px");
    pisl.style.setProperty("--py", pos.y + "px");
  }

  function clampNow() {
    pos = clampPos(pos, islandBounds(vp, size, navH));
  }

  function save() {
    saveFractions(hooks.storage, pos, vp);
  }

  /** load the saved spot (or the default) and the tip flag; call once, after measure() */
  function init() {
    pos = initialPos(loadFractions(hooks.storage), vp, size, navH);
    tipDone = loadTipDone(hooks.storage);
    apply();
  }

  /** after a resize: measure, re-clamp, and follow with the open menu and the visible tip */
  function resize() {
    measure();
    clampNow();
    apply();
    if (menuOpen()) placeMenu();
    if (tipOn) placeTipNow();
  }

  /** write the menu's position and transform origin for the island's current spot */
  function placeMenu() {
    const m = menuPlacement(pos, size, menuSize, vp, navH);
    pmenu.style.setProperty("--mx", m.x + "px");
    pmenu.style.setProperty("--my", m.y + "px");
    pmenu.style.setProperty("--mo", `${m.orgX}px ${m.orgY}px`);
  }

  // ---------- one time tip ----------
  function placeTipNow() {
    const t = placeTip(pos, size, tipSize, vp.w);
    itip.style.transform = `translate3d(${t.x}px,${t.y}px,0)`;
  }

  function showTip() {
    if (tipShown || tipDone) return;
    tipShown = true;
    tipOn = true;
    placeTipNow();
    itip.classList.add("on");
    tipTimer = setTimeout(() => hideTip(false), TIP_MS);
  }

  /** hide the tip; done = the visitor dragged or moved the island, so it never shows again */
  function hideTip(done: boolean) {
    if (tipTimer) {
      clearTimeout(tipTimer);
      tipTimer = null;
    }
    if (tipOn) {
      itip.classList.remove("on");
      tipOn = false;
    }
    if (done && !tipDone) {
      tipDone = true;
      saveTipDone(hooks.storage);
    }
  }

  /**
   * Called every frame with whether the island is on the page. The first time it is, the tip shows; if the
   * island hides again while the tip is still up (scrolling back into the scene), the tip goes with it.
   */
  function setShown(shown: boolean) {
    if (shown) showTip();
    else if (tipOn) hideTip(false);
  }

  // ---------- drag ----------
  function pointerdown(e: PointerLike) {
    if (hidden() || e.button > 0) return;
    drag = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y, moved: false };
    try {
      pisl.setPointerCapture(e.pointerId);
    } catch {
      // the pointer is already gone (released before capture): the drag still works while it stays over the island
    }
  }

  function pointermove(e: PointerLike) {
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved) {
      if (!isDrag(dx, dy)) return;
      drag.moved = true;
      pisl.classList.add("drag");
      hideTip(true);
      if (menuOpen()) hooks.onDragStart();
    }
    pos = { x: drag.ox + dx, y: drag.oy + dy };
    clampNow();
    apply();
  }

  /** pointerup / pointercancel: the event itself is not needed, the drop lands where the last move put it */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function endDrag(_e?: PointerLike) {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    pisl.classList.remove("drag");
    if (moved) {
      save();
      hooks.play(DROP_SOUND, DROP_VOLUME);
      lastDropAt = hooks.now();
    }
  }

  /** true when a click is the tail of a drag that just dropped, and must not open the menu */
  function clickFromDrag() {
    return hooks.now() - lastDropAt < CLICK_GUARD_MS;
  }

  // ---------- keyboard ----------
  function keydown(e: KeyLike) {
    if (hidden()) return;
    const d = keyDelta(e.key, e.shiftKey);
    if (!d) return;
    e.preventDefault();
    pos = { x: pos.x + d[0], y: pos.y + d[1] };
    clampNow();
    apply();
    save();
    hideTip(true);
  }

  /** where the scene's fly-out lands: the stored spot and the island's natural (unscaled) size */
  function flightTarget() {
    return { x: pos.x, y: pos.y, size };
  }

  function destroy() {
    if (tipTimer) clearTimeout(tipTimer);
    tipTimer = null;
  }

  return {
    measure,
    init,
    resize,
    placeMenu,
    setShown,
    pointerdown,
    pointermove,
    pointerup: endDrag,
    pointercancel: endDrag,
    clickFromDrag,
    keydown,
    flightTarget,
    /** the island's current top-left, viewport px */
    position: (): Pos => ({ ...pos }),
    destroy,
  };
}

export type PageIslandDriver = ReturnType<typeof createPageIsland>;
