import { beforeEach, describe, expect, it } from "vitest";
import { createIslandScene, REOPEN_MS, type IslandSceneHooks, type IslandSceneNodes } from "@/lib/islandSceneDriver";
import { BR, L, M, R, SI, T, type Dir } from "@/lib/islandScene";

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
  return { classList: new FakeClassList(), style, textContent: "", offsetWidth: 0, offsetHeight: 0, ...extra };
}

function setup() {
  const card = fakeEl();
  // the tray reports a different height for the row of 4, like the real layout would
  const tray = fakeEl({ firstElementChild: card });
  Object.defineProperty(tray, "offsetWidth", { get: () => 296 });
  Object.defineProperty(tray, "offsetHeight", { get: () => (card.classList.contains("row4") ? 450 : 504) });
  const where = fakeEl({ offsetWidth: 150 });
  const trail = { ...fakeEl(), width: 0, height: 0, getContext: () => null };
  const nodes = {
    wrap: fakeEl(),
    island: fakeEl(),
    tray,
    where,
    cursor: fakeEl(),
    trail,
  } as unknown as IslandSceneNodes;

  const log: string[] = [];
  const dirs: Dir[] = [];
  const steps: number[] = [];
  const sounds: string[] = [];
  const hooks: IslandSceneHooks = {
    setStep: (n) => void steps.push(n),
    setMode: (k) => void log.push(`set:${k}`),
    pickMode: (k) => void log.push(`pick:${k}`),
    setTrayDir: (d) => void dirs.push(d),
    play: (k) => void sounds.push(k),
  };
  const scene = createIslandScene(nodes, hooks);
  scene.measure();
  return { scene, nodes, card, tray, log, dirs, steps, sounds };
}

type Ctx = ReturnType<typeof setup>;
let c: Ctx;
let now = 0;
/** one frame at p, 16 ms after the previous one */
function frame(p: number, flight = 0) {
  now += 16;
  c.scene.read();
  c.scene.write(p, flight, now, 0.016);
}
const trayOpen = () => (c.tray as unknown as { classList: FakeClassList }).classList.contains("open");
const style = (el: unknown) => (el as { style: FakeStyle }).style;
const classes = (el: unknown) => (el as { classList: FakeClassList }).classList;

beforeEach(() => {
  c = setup();
  now = 1000;
});

describe("measure", () => {
  it("restores the card's row4 class after measuring both layouts", () => {
    c.card.classList.add("row4");
    c.scene.measure();
    expect(c.card.classList.contains("row4")).toBe(true);
    c.card.classList.remove("row4");
    c.scene.measure();
    expect(c.card.classList.contains("row4")).toBe(false);
  });
});

describe("island", () => {
  it("moves the wrapper with translate3d and shows/pulses on the timeline", () => {
    frame(0);
    expect(style(c.nodes.wrap).transform).toBe(`translate3d(${L[0]}px,${L[1]}px,0)`);
    expect(classes(c.nodes.island).contains("on")).toBe(false);
    frame(0.1);
    expect(classes(c.nodes.island).contains("on")).toBe(true);
    expect(classes(c.nodes.island).contains("pulse")).toBe(true);
    frame(0.35);
    expect(style(c.nodes.wrap).transform).toBe(`translate3d(${T[0]}px,${T[1]}px,0)`);
    expect(classes(c.nodes.island).contains("pulse")).toBe(false);
  });

  it("hides behind the open tray and hides during the flight", () => {
    frame(0.2);
    expect(trayOpen()).toBe(true);
    expect(style(c.nodes.island).visibility).toBe("hidden");
    frame(0.27);
    expect(trayOpen()).toBe(false);
    expect(style(c.nodes.island).visibility).toBe("visible");
    frame(0.9, 0.3);
    expect(classes(c.nodes.island).contains("on")).toBe(false);
  });
});

describe("tray", () => {
  it("opens at each stop in the right direction, with the origin on the island's centre", () => {
    const stops: [number, Dir, readonly [number, number]][] = [
      [0.2, "right", L],
      [0.35, "down", T],
      [0.5, "left", R],
      [0.62, "down", M],
      [0.76, "up", BR],
    ];
    for (const [p, dir, stop] of stops) {
      // pass through the drag leg before each stop so the tray closes, then wait out the reopen hold
      frame(p - 0.05);
      now += REOPEN_MS;
      frame(p);
      expect(trayOpen()).toBe(true);
      expect(c.dirs[c.dirs.length - 1]).toBe(dir);
      const [tx, ty] = style(c.tray).translate.split(" ").map(parseFloat);
      const [ox, oy] = style(c.tray)["--org"].split(" ").map(parseFloat);
      expect(tx + ox).toBeCloseTo(stop[0] + SI / 2);
      expect(ty + oy).toBeCloseTo(stop[1] + SI / 2);
    }
    // direction only reported when it changes: right, down, left, down, up
    expect(c.dirs).toEqual(["right", "down", "left", "down", "up"]);
  });

  it("plays expand on open and collapse on close", () => {
    frame(0.2);
    frame(0.27);
    expect(c.sounds).toEqual(["expand", "collapse"]);
  });

  it("a jump from one stop's window straight into another closes, holds, then reopens at the new stop", () => {
    frame(0.2);
    expect(trayOpen()).toBe(true);
    frame(0.35); // fast scroll straight from the left edge window into the notch window
    expect(trayOpen()).toBe(false);
    frame(0.35); // still inside the hold
    expect(trayOpen()).toBe(false);
    now += REOPEN_MS;
    frame(0.35);
    expect(trayOpen()).toBe(true);
    expect(c.dirs[c.dirs.length - 1]).toBe("down");
  });

  it("closes and stays closed when the scene is scrolled away", () => {
    frame(0.2);
    frame(0.02);
    expect(trayOpen()).toBe(false);
    now += 10_000;
    frame(0.02);
    expect(trayOpen()).toBe(false);
  });
});

describe("mode story", () => {
  it("sets the starting mode directly, then picks forward at each threshold", () => {
    frame(0);
    expect(c.log).toEqual(["set:anc"]);
    frame(0.17);
    expect(c.log.slice(1)).toEqual(["set:anc", "pick:amb"]);
    frame(0.34);
    expect(c.log.slice(3)).toEqual(["set:amb", "pick:talk"]);
    frame(0.47);
    expect(c.log.slice(5)).toEqual(["set:talk", "pick:anc"]);
  });

  it("sets the state directly when scrolling backward or skipping a threshold", () => {
    frame(0.5);
    expect(c.log).toEqual(["set:anc"]); // first frame lands on the last ANC directly
    frame(0.4);
    expect(c.log.slice(1)).toEqual(["set:talk"]);
    frame(0.1);
    expect(c.log.slice(2)).toEqual(["set:anc"]);
    frame(0.4); // skips Ambient: set, not pick
    expect(c.log.slice(3)).toEqual(["set:talk"]);
  });

  it("does nothing while the mode index stays the same", () => {
    frame(0.2);
    frame(0.21);
    frame(0.22);
    expect(c.log).toEqual(["set:amb"]);
  });
});

describe("steps", () => {
  it("reports the step only when it changes", () => {
    frame(0);
    frame(0.01);
    frame(0.07);
    frame(0.13);
    frame(0.3);
    frame(0.6);
    frame(0.81);
    frame(0.6);
    expect(c.steps).toEqual([0, 1, 2, 3, 4, 5, 4]);
  });
});

describe("cursor and label", () => {
  it("show during a drag and hide while the tray is open", () => {
    frame(0.29);
    expect(style(c.nodes.cursor).opacity).toBe("1");
    expect(style(c.nodes.where).opacity).toBe("1");
    expect(style(c.nodes.cursor).transform).toContain("scale(0.9)"); // pressed while dragging
    frame(0.2);
    expect(style(c.nodes.cursor).opacity).toBe("0");
    expect(style(c.nodes.where).opacity).toBe("0");
  });

  it("label text names the cell with the opening arrow", () => {
    frame(0.35);
    expect((c.nodes.where as unknown as { textContent: string }).textContent).toBe("Under the notch  ↓");
  });

  it("hidden before 0.115 and after 0.855", () => {
    frame(0.1);
    expect(style(c.nodes.cursor).opacity).toBe("0");
    frame(0.856);
    expect(style(c.nodes.cursor).opacity).toBe("0");
  });
});
