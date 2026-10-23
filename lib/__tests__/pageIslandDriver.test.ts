import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPageIsland, type PageIslandNodes } from "@/lib/pageIslandDriver";
import { POS_KEY, TIP_KEY, TIP_MS, type StorageLike } from "@/lib/pageIsland";

// Minimal stand-ins for the DOM nodes the driver touches (vitest runs in node, with no DOM).
class FakeClassList {
  private s = new Set<string>();
  contains = (c: string) => this.s.has(c);
  add = (c: string) => void this.s.add(c);
  remove = (c: string) => void this.s.delete(c);
  toggle = (c: string, on?: boolean) => {
    const want = on ?? !this.s.has(c);
    if (want) this.s.add(c);
    else this.s.delete(c);
    return want;
  };
}
type FakeStyle = Record<string, string> & { setProperty: (k: string, v: string) => void };
function fakeEl(extra: Record<string, unknown> = {}) {
  const style = {} as FakeStyle;
  style.setProperty = (k, v) => void (style[k] = v);
  return { classList: new FakeClassList(), style, offsetWidth: 0, offsetHeight: 0, ...extra };
}

function memStore(init: Record<string, string> = {}) {
  const map = new Map(Object.entries(init));
  const store: StorageLike = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
  return { store, map };
}

type Opts = { vp?: { w: number; h: number }; saved?: Record<string, string>; storage?: () => StorageLike | null };

function setup(o: Opts = {}) {
  const captured: number[] = [];
  const pisl = fakeEl({ offsetWidth: 62, setPointerCapture: (id: number) => void captured.push(id) });
  pisl.classList.add("hide");
  const pmenu = fakeEl({ offsetWidth: 300, offsetHeight: 420 });
  const itip = fakeEl({ offsetWidth: 260, offsetHeight: 34 });
  const nav = fakeEl({ offsetHeight: 64 });
  const mem = memStore(o.saved);
  let vp = o.vp ?? { w: 1440, h: 900 };
  let clock = 1000;
  const sounds: [string, number][] = [];
  let dragStarts = 0;
  const island = createPageIsland({ pisl, pmenu, itip, nav } as unknown as PageIslandNodes, {
    play: (k, v) => void sounds.push([k, v]),
    onDragStart: () => {
      dragStarts++;
      pmenu.classList.remove("open");
    },
    viewport: () => vp,
    now: () => clock,
    storage: o.storage ?? (() => mem.store),
  });
  island.measure();
  island.init();
  return {
    island,
    pisl,
    pmenu,
    itip,
    nav,
    mem,
    sounds,
    captured,
    dragStarts: () => dragStarts,
    setVp: (v: { w: number; h: number }) => void (vp = v),
    tick: (ms: number) => void (clock += ms),
  };
}

const px = (el: { style: FakeStyle }) => ({ x: parseFloat(el.style["--px"]), y: parseFloat(el.style["--py"]) });
const ptr = (x: number, y: number, button = 0) => ({ clientX: x, clientY: y, button, pointerId: 7 });
const key = (k: string, shiftKey = false) => {
  const e = { key: k, shiftKey, prevented: false, preventDefault: () => void (e.prevented = true) };
  return e;
};

let c: ReturnType<typeof setup>;
beforeEach(() => {
  vi.useFakeTimers();
  c = setup();
  c.pisl.classList.remove("hide");
});
afterEach(() => {
  c.island.destroy();
  vi.useRealTimers();
});

describe("init", () => {
  it("applies the default spot through --px/--py (never top/left)", () => {
    expect(px(c.pisl)).toEqual({ x: 20, y: 450 - 31 });
    expect(c.pisl.style.top).toBeUndefined();
    expect(c.pisl.style.left).toBeUndefined();
  });

  it("uses the phone default under 900 px", () => {
    const p = setup({ vp: { w: 390, h: 844 } });
    expect(px(p.pisl)).toEqual({ x: 16, y: 844 - 62 - 16 });
  });

  it("restores a saved spot from viewport fractions", () => {
    const p = setup({ saved: { [POS_KEY]: JSON.stringify({ fx: 0.5, fy: 0.5 }) } });
    expect(px(p.pisl)).toEqual({ x: 720, y: 450 });
  });

  it("falls back to the default when storage throws", () => {
    const p = setup({
      storage: () => {
        throw new Error("blocked");
      },
    });
    expect(px(p.pisl)).toEqual({ x: 20, y: 419 });
  });
});

describe("drag", () => {
  it("under 6 px is not a drag: no move, no sound, no save, and the click still opens the menu", () => {
    c.island.pointerdown(ptr(50, 450));
    c.island.pointermove(ptr(54, 453)); // 5 px
    expect(c.pisl.classList.contains("drag")).toBe(false);
    expect(px(c.pisl)).toEqual({ x: 20, y: 419 });
    c.island.pointerup(ptr(54, 453));
    expect(c.sounds).toEqual([]);
    expect(c.mem.map.has(POS_KEY)).toBe(false);
    expect(c.island.clickFromDrag()).toBe(false);
  });

  it("captures the pointer on press", () => {
    c.island.pointerdown(ptr(50, 450));
    expect(c.captured).toEqual([7]);
  });

  it("follows the pointer once past 6 px, with the drag class on", () => {
    c.island.pointerdown(ptr(50, 450));
    c.island.pointermove(ptr(56, 450));
    expect(c.pisl.classList.contains("drag")).toBe(true);
    expect(px(c.pisl)).toEqual({ x: 26, y: 419 });
    c.island.pointermove(ptr(350, 300));
    expect(px(c.pisl)).toEqual({ x: 320, y: 269 });
  });

  it("keeps following after the threshold even when the pointer comes back close to the start", () => {
    c.island.pointerdown(ptr(50, 450));
    c.island.pointermove(ptr(70, 450));
    c.island.pointermove(ptr(52, 450));
    expect(px(c.pisl)).toEqual({ x: 22, y: 419 });
  });

  it("clamps to the bounds while dragging (12 px edges, nav + 12 px top)", () => {
    c.island.pointerdown(ptr(50, 450));
    c.island.pointermove(ptr(-500, -500));
    expect(px(c.pisl)).toEqual({ x: 12, y: 76 });
    c.island.pointermove(ptr(5000, 5000));
    expect(px(c.pisl)).toEqual({ x: 1440 - 62 - 12, y: 900 - 62 - 12 });
  });

  it("on drop: drag class off, saves fractions, plays confirm at 0.35, and swallows the click", () => {
    c.island.pointerdown(ptr(50, 450));
    c.island.pointermove(ptr(750, 481));
    c.island.pointerup(ptr(750, 481));
    expect(c.pisl.classList.contains("drag")).toBe(false);
    expect(JSON.parse(c.mem.map.get(POS_KEY)!)).toEqual({ fx: 720 / 1440, fy: 450 / 900 });
    expect(c.sounds).toEqual([["confirm", 0.35]]);
    expect(c.island.clickFromDrag()).toBe(true);
    c.tick(59);
    expect(c.island.clickFromDrag()).toBe(true);
    c.tick(1);
    expect(c.island.clickFromDrag()).toBe(false);
  });

  it("pointercancel ends the drag the same way", () => {
    c.island.pointerdown(ptr(50, 450));
    c.island.pointermove(ptr(150, 450));
    c.island.pointercancel(ptr(150, 450));
    expect(c.pisl.classList.contains("drag")).toBe(false);
    expect(c.mem.map.has(POS_KEY)).toBe(true);
  });

  it("a move without a press does nothing, and a second release does nothing", () => {
    c.island.pointermove(ptr(500, 500));
    expect(px(c.pisl)).toEqual({ x: 20, y: 419 });
    c.island.pointerdown(ptr(50, 450));
    c.island.pointermove(ptr(150, 450));
    c.island.pointerup(ptr(150, 450));
    c.island.pointerup(ptr(150, 450));
    expect(c.sounds.length).toBe(1);
  });

  it("ignores presses while hidden, and non-primary buttons", () => {
    c.pisl.classList.add("hide");
    c.island.pointerdown(ptr(50, 450));
    c.island.pointermove(ptr(300, 450));
    expect(px(c.pisl)).toEqual({ x: 20, y: 419 });
    c.pisl.classList.remove("hide");
    c.island.pointerdown(ptr(50, 450, 2));
    c.island.pointermove(ptr(300, 450));
    expect(px(c.pisl)).toEqual({ x: 20, y: 419 });
  });

  it("survives setPointerCapture throwing", () => {
    (c.pisl as unknown as { setPointerCapture: () => void }).setPointerCapture = () => {
      throw new Error("NotFoundError");
    };
    expect(() => c.island.pointerdown(ptr(50, 450))).not.toThrow();
    c.island.pointermove(ptr(150, 450));
    expect(px(c.pisl).x).toBe(120);
  });

  it("closes an open menu when a drag starts", () => {
    c.pmenu.classList.add("open");
    c.island.pointerdown(ptr(50, 450));
    c.island.pointermove(ptr(53, 450));
    expect(c.dragStarts()).toBe(0);
    c.island.pointermove(ptr(60, 450));
    expect(c.dragStarts()).toBe(1);
    c.island.pointermove(ptr(90, 450));
    expect(c.dragStarts()).toBe(1);
  });

  it("does not ask to close the menu when it is already closed", () => {
    c.island.pointerdown(ptr(50, 450));
    c.island.pointermove(ptr(90, 450));
    expect(c.dragStarts()).toBe(0);
  });

  it("a failing storage write on drop does not break the drop", () => {
    const p = setup({
      storage: () => ({
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      }),
    });
    p.pisl.classList.remove("hide");
    p.island.pointerdown(ptr(50, 450));
    p.island.pointermove(ptr(150, 450));
    expect(() => p.island.pointerup(ptr(150, 450))).not.toThrow();
    expect(p.sounds).toEqual([["confirm", 0.35]]);
  });
});

describe("keyboard", () => {
  it("arrows move 24 px, Shift 96 px, and save", () => {
    const e = key("ArrowRight");
    c.island.keydown(e);
    expect(e.prevented).toBe(true);
    expect(px(c.pisl)).toEqual({ x: 44, y: 419 });
    c.island.keydown(key("ArrowDown", true));
    expect(px(c.pisl)).toEqual({ x: 44, y: 515 });
    c.island.keydown(key("ArrowUp"));
    c.island.keydown(key("ArrowLeft", true));
    expect(px(c.pisl)).toEqual({ x: 12, y: 491 }); // clamped at the left edge
    expect(JSON.parse(c.mem.map.get(POS_KEY)!)).toEqual({ fx: 12 / 1440, fy: 491 / 900 });
  });

  it("other keys pass through untouched (Enter and Space still click the button)", () => {
    for (const k of ["Enter", " ", "Tab", "Escape"]) {
      const e = key(k);
      c.island.keydown(e);
      expect(e.prevented).toBe(false);
    }
    expect(px(c.pisl)).toEqual({ x: 20, y: 419 });
    expect(c.mem.map.has(POS_KEY)).toBe(false);
  });

  it("does nothing while the island is hidden", () => {
    c.pisl.classList.add("hide");
    const e = key("ArrowRight");
    c.island.keydown(e);
    expect(e.prevented).toBe(false);
    expect(px(c.pisl)).toEqual({ x: 20, y: 419 });
  });

  it("does not play a sound (only a drag drop does)", () => {
    c.island.keydown(key("ArrowRight"));
    expect(c.sounds).toEqual([]);
  });
});

describe("resize", () => {
  it("re-clamps into the new viewport without saving", () => {
    c.island.pointerdown(ptr(50, 450));
    c.island.pointermove(ptr(1400, 820));
    c.island.pointerup(ptr(1400, 820));
    const saved = c.mem.map.get(POS_KEY);
    c.setVp({ w: 800, h: 600 });
    c.island.resize();
    expect(px(c.pisl)).toEqual({ x: 800 - 62 - 12, y: 600 - 62 - 12 });
    expect(c.mem.map.get(POS_KEY)).toBe(saved);
  });

  it("re-places an open menu", () => {
    c.pmenu.classList.add("open");
    c.island.placeMenu();
    const before = c.pmenu.style["--my"];
    c.setVp({ w: 1440, h: 500 });
    c.island.resize();
    expect(c.pmenu.style["--my"]).not.toBe(before);
    expect(parseFloat(c.pmenu.style["--my"])).toBe(72); // 500 - 420 - 8 = 72, which is also nav + 8
  });

  it("picks up a new nav height", () => {
    (c.nav as { offsetHeight: number }).offsetHeight = 120;
    c.island.pointerdown(ptr(50, 450));
    c.island.pointermove(ptr(50, -1000));
    c.island.pointerup(ptr(50, -1000));
    expect(px(c.pisl).y).toBe(76);
    c.island.resize();
    expect(px(c.pisl).y).toBe(132);
  });
});

describe("placeMenu", () => {
  it("writes --mx/--my/--mo for the island's spot, opening right from the left half", () => {
    c.island.placeMenu();
    expect(c.pmenu.style["--mx"]).toBe("20px");
    expect(c.pmenu.style["--my"]).toBe(`${450 - 210}px`);
    expect(c.pmenu.style["--mo"]).toBe(`31px 210px`);
  });

  it("opens left from the right half", () => {
    c.island.pointerdown(ptr(50, 450));
    c.island.pointermove(ptr(1300, 450));
    c.island.pointerup(ptr(1300, 450));
    c.island.placeMenu();
    const x = px(c.pisl).x;
    expect(parseFloat(c.pmenu.style["--mx"]) + 300).toBe(x + 62);
  });
});

describe("flight target", () => {
  it("is the stored spot and the natural size, even while the island is hidden (scaled to 0.4)", () => {
    c.island.keydown(key("ArrowRight", true));
    c.pisl.classList.add("hide");
    expect(c.island.flightTarget()).toEqual({ x: 116, y: 419, size: 62 });
  });

  it("follows the phone size", () => {
    const p = setup({ vp: { w: 390, h: 844 } });
    (p.pisl as { offsetWidth: number }).offsetWidth = 52;
    p.island.resize();
    expect(p.island.flightTarget().size).toBe(52);
  });
});

describe("one time tip", () => {
  it("shows the first time the island is on the page, beside it on the roomier side", () => {
    c.island.setShown(true);
    expect(c.itip.classList.contains("on")).toBe(true);
    expect(c.itip.style.transform).toBe(`translate3d(${20 + 62 + 12}px,${419 + 31 - 17}px,0)`);
  });

  it("sits on the left of an island in the right half", () => {
    c.island.keydown(key("ArrowRight", true)); // this dismisses for good, so use a fresh island
    const p = setup({ saved: { [POS_KEY]: JSON.stringify({ fx: 0.9, fy: 0.5 }) } });
    p.pisl.classList.remove("hide");
    p.island.setShown(true);
    expect(p.itip.style.transform).toBe(`translate3d(${1296 - 260 - 12}px,${450 + 31 - 17}px,0)`);
  });

  it("hides after 5.2 s without marking it done, and does not come back this visit", () => {
    c.island.setShown(true);
    vi.advanceTimersByTime(TIP_MS - 1);
    expect(c.itip.classList.contains("on")).toBe(true);
    vi.advanceTimersByTime(1);
    expect(c.itip.classList.contains("on")).toBe(false);
    expect(c.mem.map.has(TIP_KEY)).toBe(false);
    c.island.setShown(true);
    expect(c.itip.classList.contains("on")).toBe(false);
  });

  it("the first drag hides it and stores hush-island-tip = 1", () => {
    c.island.setShown(true);
    c.island.pointerdown(ptr(50, 450));
    c.island.pointermove(ptr(80, 450));
    expect(c.itip.classList.contains("on")).toBe(false);
    expect(c.mem.map.get(TIP_KEY)).toBe("1");
  });

  it("the first keyboard move hides it and stores hush-island-tip = 1", () => {
    c.island.setShown(true);
    c.island.keydown(key("ArrowUp"));
    expect(c.itip.classList.contains("on")).toBe(false);
    expect(c.mem.map.get(TIP_KEY)).toBe("1");
  });

  it("a click (under 6 px) does not dismiss it for good", () => {
    c.island.setShown(true);
    c.island.pointerdown(ptr(50, 450));
    c.island.pointermove(ptr(52, 450));
    c.island.pointerup(ptr(52, 450));
    expect(c.mem.map.has(TIP_KEY)).toBe(false);
  });

  it("never shows once hush-island-tip is stored", () => {
    const p = setup({ saved: { [TIP_KEY]: "1" } });
    p.island.setShown(true);
    expect(p.itip.classList.contains("on")).toBe(false);
  });

  it("does not show while the island is still hidden", () => {
    c.island.setShown(false);
    expect(c.itip.classList.contains("on")).toBe(false);
  });

  it("hides with the island if it goes away again (scrolling back into the scene), without coming back", () => {
    c.island.setShown(true);
    c.island.setShown(false);
    expect(c.itip.classList.contains("on")).toBe(false);
    c.island.setShown(true);
    expect(c.itip.classList.contains("on")).toBe(false);
  });

  it("dismissing with storage blocked still hides it and does not throw", () => {
    const p = setup({
      storage: () => {
        throw new Error("blocked");
      },
    });
    p.pisl.classList.remove("hide");
    p.island.setShown(true);
    expect(p.itip.classList.contains("on")).toBe(true);
    expect(() => p.island.keydown(key("ArrowUp"))).not.toThrow();
    expect(p.itip.classList.contains("on")).toBe(false);
  });

  it("destroy clears the pending hide timer", () => {
    c.island.setShown(true);
    c.island.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("follows the island on resize while visible", () => {
    c.island.setShown(true);
    c.setVp({ w: 1440, h: 450 });
    c.island.resize();
    // the island is clamped up to y 450 - 62 - 12 = 376, and the tip follows it
    expect(px(c.pisl).y).toBe(376);
    expect(c.itip.style.transform).toBe(`translate3d(94px,${376 + 31 - 17}px,0)`);
  });
});
