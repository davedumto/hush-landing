import { describe, expect, it } from "vitest";
import {
  BR,
  L,
  LEGS,
  M,
  MODES,
  OPEN,
  R,
  SI,
  STATIC_P,
  STEPS,
  T,
  VH,
  VW,
  cell,
  cellName,
  cursorAt,
  cursorPress,
  eio,
  isRow4,
  labelAt,
  labelText,
  modeAction,
  modeIndexAt,
  openIndexAt,
  placeTray,
  posAt,
  sceneFrame,
  stepAt,
  trayDir,
} from "@/lib/islandScene";

const size = (row4: boolean) => (row4 ? { w: 296, h: 450 } : { w: 296, h: 504 });

describe("stops", () => {
  it("match the guide's coordinates", () => {
    expect(L).toEqual([20, 361]);
    expect(T).toEqual([601, 42]);
    expect(R).toEqual([1182, 361]);
    expect(M).toEqual([601, 361]);
    // bottom right: centre at 0.8 W, 0.82 H
    expect(BR[0] + SI / 2).toBeCloseTo(0.8 * VW);
    expect(BR[1] + SI / 2).toBeCloseTo(0.82 * VH);
  });

  it("legs chain L to T to R to M to BR and back to L", () => {
    const path = [LEGS[0][0], ...LEGS.map((l) => l[1])];
    expect(path).toEqual([L, T, R, M, BR, L]);
    for (let i = 1; i < LEGS.length; i++) expect(LEGS[i][0]).toBe(LEGS[i - 1][1]);
  });

  it("no tray window overlaps a drag leg, and windows sit between legs in order", () => {
    for (const [a, b] of OPEN) {
      for (const [, , s, e] of LEGS) expect(b < s || a > e).toBe(true);
    }
    for (let i = 1; i < OPEN.length; i++) expect(OPEN[i][0]).toBeGreaterThan(OPEN[i - 1][1]);
  });
});

describe("eio", () => {
  it("is a cubic ease in-out pinned at 0, 0.5 and 1", () => {
    expect(eio(0)).toBe(0);
    expect(eio(0.5)).toBe(0.5);
    expect(eio(1)).toBe(1);
    expect(eio(0.25)).toBeCloseTo(0.0625);
    expect(eio(0.75)).toBeCloseTo(0.9375);
  });
});

describe("posAt", () => {
  it("rests on the left edge before the first drag and after the last one", () => {
    expect(posAt(0)).toEqual({ x: 20, y: 361, mv: false });
    expect(posAt(0.25)).toEqual({ x: 20, y: 361, mv: false });
    expect(posAt(0.9)).toEqual({ x: 20, y: 361, mv: false });
    expect(posAt(1)).toEqual({ x: 20, y: 361, mv: false });
  });

  it("rests at each stop between legs", () => {
    expect(posAt(0.35)).toMatchObject({ x: T[0], y: T[1], mv: false });
    expect(posAt(0.5)).toMatchObject({ x: R[0], y: R[1], mv: false });
    expect(posAt(0.62)).toMatchObject({ x: M[0], y: M[1], mv: false });
    expect(posAt(0.76)).toMatchObject({ x: BR[0], y: BR[1], mv: false });
  });

  it("lands exactly on each leg's end, not moving, at the boundaries", () => {
    for (const [a, b, s, e] of LEGS) {
      const start = posAt(s);
      expect(start.x).toBeCloseTo(a[0]);
      expect(start.y).toBeCloseTo(a[1]);
      expect(start.mv).toBe(false);
      const end = posAt(e);
      expect(end.x).toBeCloseTo(b[0]);
      expect(end.y).toBeCloseTo(b[1]);
      expect(end.mv).toBe(false);
    }
  });

  it("travels on an upward arc of 30 virtual px at the leg midpoint", () => {
    for (const [a, b, s, e] of LEGS) {
      const mid = posAt((s + e) / 2);
      expect(mid.mv).toBe(true);
      expect(mid.x).toBeCloseTo((a[0] + b[0]) / 2);
      expect(mid.y).toBeCloseTo((a[1] + b[1]) / 2 - 30);
    }
  });

  it("is continuous across the whole pin (no jumps bigger than a leg step)", () => {
    let prev = posAt(0);
    for (let i = 1; i <= 2000; i++) {
      const q = posAt(i / 2000);
      expect(Math.hypot(q.x - prev.x, q.y - prev.y)).toBeLessThan(40);
      prev = q;
    }
  });
});

describe("3 x 3 rule", () => {
  it("names and directions at each stop match the guide", () => {
    expect([cellName(...L), trayDir(...L)]).toEqual(["Left edge", "right"]);
    expect([cellName(...T), trayDir(...T)]).toEqual(["Under the notch", "down"]);
    expect([cellName(...R), trayDir(...R)]).toEqual(["Right edge", "left"]);
    expect([cellName(...M), trayDir(...M)]).toEqual(["Middle", "down"]);
    expect([cellName(...BR), trayDir(...BR)]).toEqual(["Bottom right", "up"]);
  });

  it("every cell opens the right way", () => {
    // centres of each cell, converted to island top-left
    const at = (h: number, v: number) => [((h + 0.5) * VW) / 3 - SI / 2, ((v + 0.5) * VH) / 3 - SI / 2] as const;
    const want = [
      ["down", "down", "down"],
      ["right", "down", "left"],
      ["up", "up", "up"],
    ];
    for (let v = 0; v < 3; v++) for (let h = 0; h < 3; h++) expect(trayDir(...at(h, v))).toBe(want[v][h]);
  });

  it("uses the island's centre, with exact thirds belonging to the middle cell", () => {
    expect(cell(VW / 3 - SI / 2, 0).h).toBe(1);
    expect(cell(VW / 3 - SI / 2 - 0.01, 0).h).toBe(0);
    expect(cell((VW * 2) / 3 - SI / 2, 0).h).toBe(1);
    expect(cell((VW * 2) / 3 - SI / 2 + 0.01, 0).h).toBe(2);
  });

  it("row of 4 only for up and down", () => {
    expect(isRow4("up")).toBe(true);
    expect(isRow4("down")).toBe(true);
    expect(isRow4("left")).toBe(false);
    expect(isRow4("right")).toBe(false);
  });

  it("label text has the name and arrow, with no dashes", () => {
    expect(labelText(...T)).toBe("Under the notch  ↓");
    expect(labelText(...L)).toBe("Left edge  →");
    expect(labelText(...R)).toBe("Right edge  ←");
    expect(labelText(...BR)).toBe("Bottom right  ↑");
    expect(labelText(...M)).not.toMatch(/[-–—]/);
  });
});

describe("placeTray", () => {
  it("left edge: opens right, tray left at the island's left, centred vertically, 2 x 2", () => {
    const pl = placeTray(...L, size);
    expect(pl.dir).toBe("right");
    expect(pl.x).toBe(20);
    expect(pl.y).toBe(361 + SI / 2 - 504 / 2);
    expect([pl.orgX, pl.orgY]).toEqual([SI / 2, 504 / 2]);
  });

  it("under the notch: opens down, tray top at the island's top, clamped 40 px below the screen top", () => {
    const pl = placeTray(...T, size);
    expect(pl.dir).toBe("down");
    expect(pl.y).toBe(42);
    expect(pl.x).toBe(601 + SI / 2 - 148);
    expect(pl.orgX).toBe(148);
    expect(pl.orgY).toBe(SI / 2);
  });

  it("right edge: opens left, tray right at the island's right", () => {
    const pl = placeTray(...R, size);
    expect(pl.dir).toBe("left");
    expect(pl.x + 296).toBe(R[0] + SI);
  });

  it("middle: opens down (row of 4), clamped so it stays on screen", () => {
    // 361 + 450 = 811 > 790 does not fit down; up: 361 + 78 - 450 = -11 < 40 does not fit either, so it stays down and clamps
    const pl = placeTray(...M, size);
    expect(pl.dir).toBe("down");
    expect(pl.y).toBe(VH - 450 - 10);
    // origin still points at the island's centre after the clamp
    expect(pl.y + pl.orgY).toBe(M[1] + SI / 2);
  });

  it("bottom right: opens up, tray bottom at the island's bottom", () => {
    const pl = placeTray(...BR, size);
    expect(pl.dir).toBe("up");
    expect(pl.y + 450).toBeCloseTo(BR[1] + SI);
  });

  it("flips to the opposite side when the preferred one does not fit but the other does", () => {
    // middle cell (prefers down), low enough that a 400 tall tray overflows the bottom but fits upward
    const tray = () => ({ w: 296, h: 400 });
    const x = M[0], y = 450;
    expect(trayDir(x, y)).toBe("down");
    // down: 450 + 400 = 850 > 790 does not fit; up: 450 + 78 - 400 = 128 >= 40 fits
    const pl = placeTray(x, y, tray);
    expect(pl.dir).toBe("up");
    expect(pl.y + 400).toBe(y + SI);
  });

  it("does not flip when neither side fits: keeps the preferred side and clamps", () => {
    // middle stop, row of 4 tray (450 tall): down 361 + 450 > 790, up 439 - 450 < 40
    const pl = placeTray(...M, size);
    expect(pl.dir).toBe("down");
    expect(pl.y).toBe(VH - 450 - 10);
    // a tray wider than the room on either side of a middle-left island stays right and clamps
    const wide = () => ({ w: 900, h: 200 });
    const side = placeTray(380, M[1], wide);
    expect(side.dir).toBe("right");
    expect(side.x).toBe(VW - 900 - 10);
  });

  it("always stays inside the screen margins", () => {
    for (let i = 0; i <= 200; i++) {
      const q = posAt(i / 200);
      for (const row4 of [false, true]) {
        const pl = placeTray(q.x, q.y, () => size(row4));
        const s = size(isRow4(pl.dir));
        expect(pl.x).toBeGreaterThanOrEqual(10);
        expect(pl.x + s.w).toBeLessThanOrEqual(VW - 10);
        expect(pl.y).toBeGreaterThanOrEqual(40);
        expect(pl.y + s.h).toBeLessThanOrEqual(VH - 10);
        // the origin is always the island's centre
        expect(pl.x + pl.orgX).toBeCloseTo(q.x + SI / 2);
        expect(pl.y + pl.orgY).toBeCloseTo(q.y + SI / 2);
      }
    }
  });
});

describe("timeline lookups", () => {
  it("steps start at the guide's thresholds", () => {
    expect(STEPS).toEqual([0, 0.065, 0.12, 0.26, 0.53, 0.8]);
    expect(stepAt(0)).toBe(0);
    expect(stepAt(0.0649)).toBe(0);
    expect(stepAt(0.065)).toBe(1);
    expect(stepAt(0.12)).toBe(2);
    expect(stepAt(0.26)).toBe(3);
    expect(stepAt(0.53)).toBe(4);
    expect(stepAt(0.8)).toBe(5);
    expect(stepAt(1)).toBe(5);
  });

  it("open windows are inclusive on both ends", () => {
    expect(openIndexAt(0.1299)).toBe(-1);
    expect(openIndexAt(0.13)).toBe(0);
    expect(openIndexAt(0.25)).toBe(0);
    expect(openIndexAt(0.2501)).toBe(-1);
    expect(openIndexAt(0.35)).toBe(1);
    expect(openIndexAt(0.5)).toBe(2);
    expect(openIndexAt(0.62)).toBe(3);
    expect(openIndexAt(0.76)).toBe(4);
    expect(openIndexAt(0.82)).toBe(-1);
  });

  it("mode index follows the story thresholds", () => {
    expect(MODES.map((m) => m[1])).toEqual(["anc", "amb", "talk", "anc"]);
    expect(modeIndexAt(0)).toBe(0);
    expect(modeIndexAt(0.1599)).toBe(0);
    expect(modeIndexAt(0.16)).toBe(1);
    expect(modeIndexAt(0.33)).toBe(2);
    expect(modeIndexAt(0.468)).toBe(3);
    expect(modeIndexAt(1)).toBe(3);
  });

  it("each mode pick happens while its stop's tray is open", () => {
    expect(openIndexAt(0.16)).toBe(0);
    expect(openIndexAt(0.33)).toBe(1);
    expect(openIndexAt(0.468)).toBe(2);
  });
});

describe("modeAction", () => {
  it("does nothing when the mode index has not changed", () => {
    expect(modeAction(2, 2)).toEqual({ kind: "none" });
  });
  it("sets directly on the first frame", () => {
    expect(modeAction(-1, 0)).toEqual({ kind: "set", mode: "anc" });
    expect(modeAction(-1, 2)).toEqual({ kind: "set", mode: "talk" });
  });
  it("runs a real pick when crossing one threshold forward", () => {
    expect(modeAction(0, 1)).toEqual({ kind: "pick", from: "anc", to: "amb" });
    expect(modeAction(1, 2)).toEqual({ kind: "pick", from: "amb", to: "talk" });
    expect(modeAction(2, 3)).toEqual({ kind: "pick", from: "talk", to: "anc" });
  });
  it("sets directly when crossing backward or skipping a threshold", () => {
    expect(modeAction(3, 2)).toEqual({ kind: "set", mode: "talk" });
    expect(modeAction(1, 0)).toEqual({ kind: "set", mode: "anc" });
    expect(modeAction(0, 2)).toEqual({ kind: "set", mode: "talk" });
  });
});

describe("cursor and label", () => {
  it("cursor rides at 62 % across and 60 % down the island", () => {
    expect(cursorAt(100, 200)).toEqual({ x: 100 + SI * 0.62, y: 200 + SI * 0.6 });
  });
  it("cursor presses while dragging and just around each tray click", () => {
    expect(cursorPress(0.2, true)).toBe(true);
    expect(cursorPress(0.2, false)).toBe(false);
    for (const [a] of OPEN) {
      expect(cursorPress(a - 0.006, false)).toBe(true);
      expect(cursorPress(a + 0.0039, false)).toBe(true);
      expect(cursorPress(a - 0.0061, false)).toBe(false);
      expect(cursorPress(a + 0.004, false)).toBe(false);
    }
  });
  it("label sits under the island in the top half and above it in the bottom half, clamped to the screen", () => {
    expect(labelAt(...T, 160)).toEqual({ x: 601 + SI / 2 - 80, y: 42 + SI + 12 });
    expect(labelAt(...BR, 160).y).toBeCloseTo(BR[1] - 40);
    expect(labelAt(0, 100, 160).x).toBe(8);
    expect(labelAt(VW, 100, 160).x).toBe(VW - 160 - 8);
  });
});

describe("sceneFrame", () => {
  it("hides the island before 0.06 and during the flight", () => {
    expect(sceneFrame(0.06, 0).shown).toBe(false);
    expect(sceneFrame(0.0601, 0).shown).toBe(true);
    expect(sceneFrame(0.9, 0.2).shown).toBe(false);
    expect(sceneFrame(0.9, 0.2).openIdx).toBe(-1);
  });
  it("pulses only between 0.075 and 0.125", () => {
    expect(sceneFrame(0.075, 0).pulse).toBe(false);
    expect(sceneFrame(0.1, 0).pulse).toBe(true);
    expect(sceneFrame(0.125, 0).pulse).toBe(false);
  });
  it("demo window is 0.115 to 0.855", () => {
    expect(sceneFrame(0.115, 0).demo).toBe(false);
    expect(sceneFrame(0.116, 0).demo).toBe(true);
    expect(sceneFrame(0.854, 0).demo).toBe(true);
    expect(sceneFrame(0.855, 0).demo).toBe(false);
  });
  it("the island is back on the left edge (on the anchor) before the flight starts", () => {
    expect(sceneFrame(0.86, 0).pos).toEqual({ x: L[0], y: L[1], mv: false });
  });
  it("reduced motion progress shows the tray open at the left edge with Ambient", () => {
    const f = sceneFrame(STATIC_P, 0);
    expect(f.openIdx).toBe(0);
    expect(f.pos).toMatchObject({ x: L[0], y: L[1] });
    expect(MODES[f.modeIdx][1]).toBe("amb");
    expect(f.step).toBe(2);
  });
});
