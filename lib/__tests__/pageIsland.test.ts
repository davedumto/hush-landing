import { describe, expect, it } from "vitest";
import {
  CLICK_GUARD_MS,
  DRAG_PX,
  DROP_SOUND,
  DROP_VOLUME,
  EDGE,
  KEY_STEP,
  KEY_STEP_SHIFT,
  MENU_EDGE,
  POS_KEY,
  TIP_GAP,
  TIP_KEY,
  TIP_MS,
  WIDE,
  clampPos,
  defaultPos,
  fromFractions,
  initialPos,
  isDrag,
  islandBounds,
  keyDelta,
  loadFractions,
  loadTipDone,
  placeMenu,
  placeTip,
  saveFractions,
  saveTipDone,
  toFractions,
  type StorageLike,
} from "@/lib/pageIsland";

const DESK = { w: 1440, h: 900 };
const PHONE = { w: 390, h: 844 };
const NAV = 64;

/** an in-memory localStorage stand-in */
function memStore(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  const store: StorageLike & { map: Map<string, string> } = {
    map: m,
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, String(v)),
  };
  return store;
}
/** a storage whose every call throws (blocked site data, quota exceeded) */
const throwingStore: StorageLike = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

describe("constants", () => {
  it("match the guide", () => {
    expect(WIDE).toBe(900);
    expect(EDGE).toBe(12);
    expect(MENU_EDGE).toBe(8);
    expect(DRAG_PX).toBe(6);
    expect(KEY_STEP).toBe(24);
    expect(KEY_STEP_SHIFT).toBe(96);
    expect(TIP_GAP).toBe(12);
    expect(TIP_MS).toBe(5200);
    expect(CLICK_GUARD_MS).toBe(60);
    expect(DROP_SOUND).toBe("confirm");
    expect(DROP_VOLUME).toBe(0.35);
    expect(POS_KEY).toBe("hush-island");
    expect(TIP_KEY).toBe("hush-island-tip");
  });
});

describe("defaultPos", () => {
  it("900 px and up: 20 px from the left, vertically centred", () => {
    expect(defaultPos(DESK, 62)).toEqual({ x: 20, y: 900 / 2 - 31 });
    expect(defaultPos({ w: 900, h: 700 }, 62)).toEqual({ x: 20, y: 319 });
  });

  it("under 900 px: 16 px from the left and 16 px from the bottom", () => {
    expect(defaultPos(PHONE, 52)).toEqual({ x: 16, y: 844 - 52 - 16 });
    expect(defaultPos({ w: 899, h: 700 }, 52)).toEqual({ x: 16, y: 632 });
  });

  it("uses the island's own size", () => {
    expect(defaultPos(DESK, 80).y).toBe(450 - 40);
    expect(defaultPos(PHONE, 80).y).toBe(844 - 80 - 16);
  });
});

describe("islandBounds / clampPos", () => {
  const b = islandBounds(DESK, 62, NAV);

  it("keeps 12 px from every edge, and 12 px below the nav at the top", () => {
    expect(b).toEqual({ x0: 12, y0: 76, x1: 1440 - 62 - 12, y1: 900 - 62 - 12 });
  });

  it("leaves a position inside the bounds alone", () => {
    expect(clampPos({ x: 300, y: 400 }, b)).toEqual({ x: 300, y: 400 });
  });

  it("clamps past every edge", () => {
    expect(clampPos({ x: -50, y: 400 }, b)).toEqual({ x: 12, y: 400 });
    expect(clampPos({ x: 5000, y: 400 }, b)).toEqual({ x: 1366, y: 400 });
    expect(clampPos({ x: 300, y: 0 }, b)).toEqual({ x: 300, y: 76 });
    expect(clampPos({ x: 300, y: 5000 }, b)).toEqual({ x: 300, y: 826 });
    expect(clampPos({ x: -1, y: -1 }, b)).toEqual({ x: 12, y: 76 });
    expect(clampPos({ x: 1e6, y: 1e6 }, b)).toEqual({ x: 1366, y: 826 });
  });

  it("sits exactly on the bounds", () => {
    expect(clampPos({ x: 12, y: 76 }, b)).toEqual({ x: 12, y: 76 });
    expect(clampPos({ x: 1366, y: 826 }, b)).toEqual({ x: 1366, y: 826 });
  });

  it("on a viewport too small for the island, the left edge and the nav win", () => {
    const tiny = islandBounds({ w: 50, h: 100 }, 62, NAV);
    expect(tiny.x1).toBeLessThan(tiny.x0);
    expect(tiny.y1).toBeLessThan(tiny.y0);
    expect(clampPos({ x: 500, y: 500 }, tiny)).toEqual({ x: 12, y: 76 });
    expect(clampPos({ x: -500, y: -500 }, tiny)).toEqual({ x: 12, y: 76 });
  });

  it("the default spot is inside the bounds on common screens", () => {
    for (const vp of [DESK, PHONE, { w: 900, h: 600 }, { w: 1280, h: 720 }, { w: 320, h: 568 }]) {
      const s = vp.w < WIDE ? 52 : 62;
      const p = defaultPos(vp, s);
      expect(clampPos(p, islandBounds(vp, s, NAV))).toEqual(p);
    }
  });
});

describe("isDrag (6 px threshold)", () => {
  it("anything under 6 px is a click", () => {
    expect(isDrag(0, 0)).toBe(false);
    expect(isDrag(5, 0)).toBe(false);
    expect(isDrag(0, -5.9)).toBe(false);
    expect(isDrag(4, 4)).toBe(false); // 5.66 px
  });

  it("6 px or more, in any direction, is a drag", () => {
    expect(isDrag(6, 0)).toBe(true);
    expect(isDrag(-6, 0)).toBe(true);
    expect(isDrag(0, 6)).toBe(true);
    expect(isDrag(0, -6)).toBe(true);
    expect(isDrag(3.6, 4.8)).toBe(true); // exactly 6 px on the diagonal
    expect(isDrag(5, 5)).toBe(true); // 7.07 px
  });
});

describe("keyDelta", () => {
  it("arrows move 24 px", () => {
    expect(keyDelta("ArrowLeft", false)).toEqual([-24, 0]);
    expect(keyDelta("ArrowRight", false)).toEqual([24, 0]);
    expect(keyDelta("ArrowUp", false)).toEqual([0, -24]);
    expect(keyDelta("ArrowDown", false)).toEqual([0, 24]);
  });

  it("Shift moves 96 px", () => {
    expect(keyDelta("ArrowLeft", true)).toEqual([-96, 0]);
    expect(keyDelta("ArrowRight", true)).toEqual([96, 0]);
    expect(keyDelta("ArrowUp", true)).toEqual([0, -96]);
    expect(keyDelta("ArrowDown", true)).toEqual([0, 96]);
  });

  it("other keys do nothing", () => {
    for (const k of ["Enter", " ", "Tab", "Escape", "a", "Home", "arrowleft"]) {
      expect(keyDelta(k, false)).toBeNull();
      expect(keyDelta(k, true)).toBeNull();
    }
  });
});

describe("placeMenu", () => {
  const menu = { w: 300, h: 420 };

  it("island in the left half: the menu's left edge lines up with the island's left edge", () => {
    const m = placeMenu({ x: 100, y: 300 }, 62, menu, DESK, NAV);
    expect(m.x).toBe(100);
  });

  it("island in the right half: the menu's right edge lines up with the island's right edge", () => {
    const m = placeMenu({ x: 1000, y: 300 }, 62, menu, DESK, NAV);
    expect(m.x + menu.w).toBe(1000 + 62);
  });

  it("the half is decided by the island's centre, not its left edge", () => {
    // left edge in the left half, centre exactly on the midline: counts as the right half
    expect(placeMenu({ x: 720 - 31, y: 300 }, 62, menu, DESK, NAV).x).toBe(720 - 31 + 62 - 300);
    // centre just left of the midline
    expect(placeMenu({ x: 720 - 32, y: 300 }, 62, menu, DESK, NAV).x).toBe(720 - 32);
  });

  it("is vertically centred on the island", () => {
    const m = placeMenu({ x: 100, y: 400 }, 62, menu, DESK, NAV);
    expect(m.y + menu.h / 2).toBe(400 + 31);
  });

  it("clamps 8 px below the nav at the top", () => {
    const m = placeMenu({ x: 100, y: 76 }, 62, menu, DESK, NAV);
    expect(m.y).toBe(NAV + 8);
  });

  it("clamps 8 px inside the bottom", () => {
    const m = placeMenu({ x: 100, y: 826 }, 62, menu, DESK, NAV);
    expect(m.y).toBe(900 - 420 - 8);
  });

  it("clamps 8 px inside the left and right edges", () => {
    // right half, but the menu would poke off the left on a narrow screen
    const narrow = { w: 320, h: 700 };
    const r = placeMenu({ x: 200, y: 300 }, 52, { w: 288, h: 420 }, narrow, NAV);
    // unclamped it would be 200 + 52 - 288 = -36
    expect(r.x).toBe(8);
    // left half, but the menu would poke off the right
    const l = placeMenu({ x: 140, y: 300 }, 30, { w: 288, h: 420 }, narrow, NAV);
    expect(l.x).toBe(320 - 288 - 8);
  });

  it("a menu taller than the space keeps its top below the nav", () => {
    const m = placeMenu({ x: 100, y: 200 }, 62, { w: 300, h: 2000 }, DESK, NAV);
    expect(m.y).toBe(NAV + 8);
  });

  it("the transform origin is the island's centre, relative to the menu", () => {
    for (const p of [
      { x: 100, y: 300 },
      { x: 1000, y: 300 },
      { x: 100, y: 76 },
      { x: 1366, y: 826 },
    ]) {
      const m = placeMenu(p, 62, menu, DESK, NAV);
      expect(m.x + m.orgX).toBe(p.x + 31);
      expect(m.y + m.orgY).toBe(p.y + 31);
    }
  });

  it("left half / right half with the default phone spot", () => {
    const p = defaultPos(PHONE, 52);
    const m = placeMenu(p, 52, { w: 300, h: 420 }, PHONE, NAV);
    expect(m.x).toBe(16);
    expect(m.y).toBe(844 - 420 - 8); // island at the bottom: clamped up
  });
});

describe("placeTip", () => {
  const tip = { w: 260, h: 34 };

  it("island in the left half: the tip sits to its right, 12 px away", () => {
    expect(placeTip({ x: 20, y: 400 }, 62, tip, 1440)).toEqual({ x: 20 + 62 + 12, y: 400 + 31 - 17 });
  });

  it("island in the right half: the tip sits to its left, 12 px away", () => {
    expect(placeTip({ x: 1300, y: 400 }, 62, tip, 1440)).toEqual({ x: 1300 - 260 - 12, y: 400 + 31 - 17 });
  });
});

describe("fractions", () => {
  it("round-trip a position through viewport fractions", () => {
    const p = { x: 300, y: 450 };
    const f = toFractions(p, DESK);
    expect(f).toEqual({ fx: 300 / 1440, fy: 0.5 });
    expect(fromFractions(f, DESK)).toEqual(p);
  });

  it("scale with the viewport", () => {
    expect(fromFractions({ fx: 0.5, fy: 0.25 }, { w: 800, h: 400 })).toEqual({ x: 400, y: 100 });
  });
});

describe("saved position storage", () => {
  it("save then load round-trips through localStorage as {fx, fy}", () => {
    const s = memStore();
    expect(saveFractions(() => s, { x: 720, y: 225 }, DESK)).toBe(true);
    expect(JSON.parse(s.map.get(POS_KEY)!)).toEqual({ fx: 0.5, fy: 0.25 });
    expect(loadFractions(() => s)).toEqual({ fx: 0.5, fy: 0.25 });
  });

  it("loads null when nothing is saved", () => {
    expect(loadFractions(() => memStore())).toBeNull();
  });

  it("loads null for junk or partial values", () => {
    for (const v of ["not json", "null", "42", '"x"', "{}", '{"fx":0.5}', '{"fx":"0.5","fy":0.2}', '{"fx":null,"fy":0.2}', "[0.1,0.2]"]) {
      expect(loadFractions(() => memStore({ [POS_KEY]: v }))).toBeNull();
    }
  });

  it("loads null for non-finite numbers", () => {
    // JSON cannot carry NaN or Infinity, but a huge exponent parses to Infinity
    expect(loadFractions(() => memStore({ [POS_KEY]: '{"fx":1e400,"fy":0.2}' }))).toBeNull();
  });

  it("never throws when storage throws, on read or write", () => {
    expect(loadFractions(() => throwingStore)).toBeNull();
    expect(saveFractions(() => throwingStore, { x: 1, y: 1 }, DESK)).toBe(false);
  });

  it("never throws when merely reaching localStorage throws", () => {
    const blocked = () => {
      throw new Error("SecurityError: access denied");
    };
    expect(loadFractions(blocked)).toBeNull();
    expect(saveFractions(blocked, { x: 1, y: 1 }, DESK)).toBe(false);
    expect(loadTipDone(blocked)).toBe(false);
    expect(saveTipDone(blocked)).toBe(false);
  });

  it("handles storage being unavailable (null / undefined)", () => {
    expect(loadFractions(() => null)).toBeNull();
    expect(loadFractions(() => undefined)).toBeNull();
    expect(saveFractions(() => null, { x: 1, y: 1 }, DESK)).toBe(false);
    expect(loadTipDone(() => null)).toBe(false);
    expect(saveTipDone(() => undefined)).toBe(false);
  });

  it("does not save against a zero-size viewport (would write NaN / Infinity)", () => {
    const s = memStore();
    expect(saveFractions(() => s, { x: 10, y: 10 }, { w: 0, h: 0 })).toBe(false);
    expect(s.map.size).toBe(0);
  });
});

describe("initialPos", () => {
  it("uses the default spot when nothing is saved", () => {
    expect(initialPos(null, DESK, 62, NAV)).toEqual(defaultPos(DESK, 62));
    expect(initialPos(null, PHONE, 52, NAV)).toEqual(defaultPos(PHONE, 52));
  });

  it("uses the saved fractions of the current viewport", () => {
    expect(initialPos({ fx: 0.5, fy: 0.5 }, DESK, 62, NAV)).toEqual({ x: 720, y: 450 });
  });

  it("clamps a saved spot that no longer fits (saved on a bigger screen)", () => {
    expect(initialPos({ fx: 0.99, fy: 0.99 }, DESK, 62, NAV)).toEqual({ x: 1366, y: 826 });
    expect(initialPos({ fx: 0, fy: 0 }, DESK, 62, NAV)).toEqual({ x: 12, y: 76 });
    expect(initialPos({ fx: -3, fy: 7 }, PHONE, 52, NAV)).toEqual({ x: 12, y: 844 - 52 - 12 });
  });
});

describe("tip flag storage", () => {
  it("is false until saved, then true", () => {
    const s = memStore();
    expect(loadTipDone(() => s)).toBe(false);
    expect(saveTipDone(() => s)).toBe(true);
    expect(s.map.get(TIP_KEY)).toBe("1");
    expect(loadTipDone(() => s)).toBe(true);
  });

  it("only the exact value '1' counts", () => {
    expect(loadTipDone(() => memStore({ [TIP_KEY]: "true" }))).toBe(false);
    expect(loadTipDone(() => memStore({ [TIP_KEY]: "0" }))).toBe(false);
  });

  it("never throws when storage throws", () => {
    expect(loadTipDone(() => throwingStore)).toBe(false);
    expect(saveTipDone(() => throwingStore)).toBe(false);
  });
});
