// The island scene's DOM driver: applies the pure timeline from islandScene.ts to the #mac nodes.
// Ported from the reference's lapScene (hush-update-kit/reference/src/scene.js) with two changes that keep
// PageShell's tick() free of layout reads after writes:
//   1. The tray's size is measured up front by measure() (init, resize, fonts ready), never inside write(),
//      and the label's width is read in read(), the tick's read phase.
//   2. Switching straight from one tray stop to another does not force a reflow to restart the transition.
//      The tray closes, waits REOPEN_MS for the close to fade, then opens at the new stop.
// Everything visual is moved with transform (the tray uses the individual `translate` property, so its
// position never animates and never fights the CSS spring on `transform`).

import {
  SI,
  VW,
  VH,
  TRAIL_MS,
  cell,
  cursorAt,
  labelAt,
  labelText,
  modeAction,
  placeTray,
  sceneFrame,
  type Dir,
  type Size,
} from "@/lib/islandScene";

export type IslandSceneNodes = {
  /** wrapper the island rides in, moved with translate3d in virtual px */
  wrap: HTMLDivElement;
  island: HTMLButtonElement;
  /** the tray (.dock-card); its first child is the .card that takes the row4 class */
  tray: HTMLDivElement;
  /** position label pill */
  where: HTMLSpanElement;
  /** navy arrow cursor */
  cursor: SVGSVGElement;
  /** 1280 x 800 trail and grid canvas */
  trail: HTMLCanvasElement;
};

export type IslandSceneHooks = {
  setStep: (n: number) => void;
  /** set a mode directly (clears any pending pick) */
  setMode: (k: string) => void;
  /** run a real pick: the ring fills, then it turns orange and the tone plays */
  pickMode: (k: string) => void;
  /** the tray's opening direction changed (drives the row of 4 or 2 x 2 buttons) */
  setTrayDir: (d: Dir) => void;
  /** sound, only through lib/audio's play() (it already no-ops while sound is off) */
  play: (k: string, v: number) => void;
};

/** how long a switch between two tray stops stays closed before reopening: the close's opacity fade (180 ms) */
export const REOPEN_MS = 180;

// colours on the always light laptop screen: --o (#FF6500) and --navy-lo (#0B192C). A canvas cannot read
// CSS custom properties per frame cheaply, and neither token changes with the page theme.
const ORANGE = "255,101,0";
const NAVY_LO = "11,25,44";

// fallbacks for a tray that has not been laid out yet (296 wide card; 2 x 2 and row of 4 heights)
const FALLBACK: Record<"row2" | "row4", Size> = { row2: { w: 296, h: 504 }, row4: { w: 296, h: 450 } };

export function createIslandScene(nodes: IslandSceneNodes, hooks: IslandSceneHooks) {
  const { wrap, island, tray, where, cursor, trail } = nodes;
  trail.width = VW;
  trail.height = VH;
  const tg = trail.getContext("2d");

  let sizes = { ...FALLBACK };
  let labelW = 120;

  let lastStep = -1;
  let lastMode = -1;
  let lastLabel = "";
  let lastDir: Dir | null = null;
  let openIdx = -1;
  let open = false;
  let reopenAt = 0;
  let gridA = 0;
  const pts: { x: number; y: number; t: number }[] = [];
  let canvasDirty = false;

  /** layout reads: call outside the tick's write phase (on init, resize and fonts ready) */
  function measure() {
    const card = tray.firstElementChild as HTMLElement | null;
    if (!card) return;
    const had = card.classList.contains("row4");
    card.classList.remove("row4");
    const row2 = { w: tray.offsetWidth, h: tray.offsetHeight };
    card.classList.add("row4");
    const row4 = { w: tray.offsetWidth, h: tray.offsetHeight };
    card.classList.toggle("row4", had);
    sizes = {
      row2: row2.w > 0 && row2.h > 0 ? row2 : FALLBACK.row2,
      row4: row4.w > 0 && row4.h > 0 ? row4 : FALLBACK.row4,
    };
  }

  /** per-frame layout reads, for the tick's read phase */
  function read() {
    labelW = where.offsetWidth || 120;
  }

  function closeTray(now: number) {
    const was = open;
    tray.classList.remove("open");
    open = false;
    openIdx = -1;
    reopenAt = now + REOPEN_MS;
    if (was) hooks.play("collapse", 0.45);
  }

  function openTray(idx: number, x: number, y: number) {
    const pl = placeTray(x, y, (row4) => (row4 ? sizes.row4 : sizes.row2));
    if (pl.dir !== lastDir) {
      lastDir = pl.dir;
      hooks.setTrayDir(pl.dir);
    }
    tray.style.translate = `${pl.x}px ${pl.y}px`;
    tray.style.setProperty("--org", `${pl.orgX}px ${pl.orgY}px`);
    tray.classList.add("open");
    open = true;
    openIdx = idx;
    hooks.play("expand", 0.45);
  }

  // idx: which stop's window is open (-1 for none). A fast scroll can jump from one stop's window straight
  // into another's, so a change of stop closes the tray first and reopens it at the new place.
  function setTray(idx: number, x: number, y: number, now: number) {
    if (idx === openIdx) return;
    if (idx >= 0 && openIdx >= 0) return closeTray(now);
    if (idx < 0) return closeTray(now);
    if (now >= reopenAt) openTray(idx, x, y);
  }

  /** write phase: p is the pin progress, flight the fly-out progress (0..1), now in ms, dt in seconds */
  function write(p: number, flight: number, now: number, dt: number) {
    const f = sceneFrame(p, flight);

    if (f.step !== lastStep) {
      lastStep = f.step;
      hooks.setStep(f.step);
    }

    const ma = modeAction(lastMode, f.modeIdx);
    lastMode = f.modeIdx;
    if (ma.kind === "set") hooks.setMode(ma.mode);
    else if (ma.kind === "pick") {
      hooks.setMode(ma.from);
      hooks.pickMode(ma.to);
    }

    const { x, y, mv } = f.pos;
    wrap.style.transform = `translate3d(${x}px,${y}px,0)`;
    island.classList.toggle("on", f.shown);
    island.classList.toggle("pulse", f.pulse);
    setTray(f.openIdx, x, y, now);
    island.style.visibility = open ? "hidden" : "visible";

    // cursor, position label, grid and trail
    const showDemo = f.demo && !open;
    const c = cursorAt(x, y);
    cursor.style.opacity = showDemo ? "1" : "0";
    cursor.style.transform = `translate3d(${c.x}px,${c.y}px,0) scale(${f.press ? 0.9 : 1})`;
    const label = labelText(x, y);
    if (label !== lastLabel) {
      lastLabel = label;
      where.textContent = label;
    }
    where.style.opacity = showDemo ? "1" : "0";
    const lp = labelAt(x, y, labelW);
    where.style.transform = `translate3d(${lp.x}px,${lp.y}px,0)`;

    if (mv) pts.push({ x: x + SI / 2, y: y + SI / 2, t: now });
    // the reference eases by 0.12 per frame; this is the same at 60 fps but holds on 120 Hz screens too
    gridA += ((mv ? 1 : 0) - gridA) * (1 - Math.pow(0.88, dt * 60));
    while (pts.length && now - pts[0].t > TRAIL_MS) pts.shift();
    drawTrail(x, y, now);
  }

  function drawTrail(x: number, y: number, now: number) {
    if (!tg) return;
    const draws = gridA > 0.01 || pts.length > 0;
    if (!draws && !canvasDirty) return; // nothing on the canvas and nothing to add
    tg.clearRect(0, 0, VW, VH);
    canvasDirty = draws;
    if (!draws) return;
    if (gridA > 0.01) {
      const { h, v } = cell(x, y);
      tg.fillStyle = `rgba(${ORANGE},${0.08 * gridA})`;
      tg.fillRect((h * VW) / 3, (v * VH) / 3, VW / 3, VH / 3);
      tg.save();
      tg.setLineDash([6, 8]);
      tg.strokeStyle = `rgba(${NAVY_LO},${0.28 * gridA})`;
      tg.lineWidth = 1.5;
      tg.beginPath();
      for (let i = 1; i < 3; i++) {
        tg.moveTo((i * VW) / 3, 34);
        tg.lineTo((i * VW) / 3, VH);
        tg.moveTo(0, (i * VH) / 3);
        tg.lineTo(VW, (i * VH) / 3);
      }
      tg.stroke();
      tg.restore();
    }
    for (const pt of pts) {
      const a = 1 - (now - pt.t) / TRAIL_MS;
      tg.beginPath();
      tg.arc(pt.x, pt.y, 6 * a + 2, 0, Math.PI * 2);
      tg.fillStyle = `rgba(${ORANGE},${0.35 * a})`;
      tg.fill();
    }
  }

  return { measure, read, write };
}

export type IslandScene = ReturnType<typeof createIslandScene>;
