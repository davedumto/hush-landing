import { describe, expect, it } from "vitest";
import {
  BAND_X,
  CUES,
  DEFAULT_PRESET,
  DEFAULT_SETTINGS,
  FREQ,
  GRAPH,
  POWER_RESET_MS,
  PRESETS,
  SETTINGS,
  SWEEP_S,
  SWITCH_EPS,
  SWITCH_RATE,
  approach,
  curvePath,
  curvePoints,
  easeOut,
  fillPathFor,
  lineLook,
  pathFor,
  powerStep,
  presetById,
  settingChip,
  sweepFrame,
  sweepProgress,
  type Point,
  type PresetId,
} from "@/lib/soundFeatures";

/** parse "M x,y C a,b c,d e,f C ..." into the move point and each segment's three points */
function parsePath(d: string) {
  const m = d.match(/^M(-?[\d.]+),(-?[\d.]+)/);
  if (!m) throw new Error("no move");
  const segs = [...d.matchAll(/C(-?[\d.]+),(-?[\d.]+) (-?[\d.]+),(-?[\d.]+) (-?[\d.]+),(-?[\d.]+)/g)].map((s) =>
    s.slice(1).map(Number)
  );
  return { start: [Number(m[1]), Number(m[2])], segs };
}

/** evaluate a cubic Bezier at t */
const bez = (a: number, b: number, c: number, d: number, t: number) =>
  (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d;

describe("presets (UPDATE_GUIDE.md section 4 table, verbatim)", () => {
  const GUIDE: Record<PresetId, [string, number[]]> = {
    studio: ["Studio", [1, 0.8, 0.3, 0, 0, 0, 0.2, 0.6, 1, 1.2]],
    bass: ["Bass", [6.4, 6, 5.6, 4.4, 1.6, 0.5, 0.1, 0, 0, 0]],
    club: ["Club", [3.4, 4.4, 3.2, 1, 0, 1.2, 2.6, 3.4, 3, 2]],
    xbass: ["Extreme Bass", [9, 8.6, 7.2, 4.6, 1.4, 0.2, 0, 0, 0, 0]],
    vocal: ["Vocal", [-2.4, -1.8, -0.8, 0.6, 2.6, 4.4, 4, 2, 0.4, -0.8]],
    jazz: ["Jazz", [3.4, 2.4, 1.2, 2.2, -1.2, -1.4, 0, 1.2, 2.4, 3.2]],
  };

  it("has exactly the six presets, in the app's order", () => {
    expect(PRESETS.map((p) => p.id)).toEqual(["studio", "bass", "club", "xbass", "vocal", "jazz"]);
  });

  it.each(Object.entries(GUIDE))("%s matches the guide's name and gains", (id, [name, db]) => {
    const p = presetById(id as PresetId);
    expect(p.name).toBe(name);
    expect([...p.db]).toEqual(db);
  });

  it("every preset has one gain per band, all finite", () => {
    for (const p of PRESETS) {
      expect(p.db).toHaveLength(FREQ.length);
      p.db.forEach((v) => expect(Number.isFinite(v)).toBe(true));
    }
  });

  it("ids and names are unique", () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    expect(new Set(PRESETS.map((p) => p.name)).size).toBe(PRESETS.length);
  });

  it("starts on Bass", () => {
    expect(DEFAULT_PRESET).toBe("bass");
  });

  it("presetById throws on an unknown id instead of drawing a flat curve", () => {
    expect(() => presetById("rock" as PresetId)).toThrow(/unknown preset/);
  });

  it("band labels run 32 Hz to 16 kHz", () => {
    expect([...FREQ]).toEqual(["32", "64", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"]);
  });
});

describe("graph geometry", () => {
  it("is the reference's 300 x 150 area, bands 23 to 277, 0 dB at y 78, 6.2 per dB", () => {
    expect(GRAPH).toMatchObject({ W: 300, H: 150, X0: 23, X1: 277, Y0: 78, K: 6.2, BOTTOM: 122, TOP: 10 });
  });

  it("spaces the ten bands evenly from X0 to X1", () => {
    expect(BAND_X).toHaveLength(10);
    expect(BAND_X[0]).toBe(23);
    expect(BAND_X[9]).toBe(277);
    for (let i = 1; i < 10; i++) expect(BAND_X[i] - BAND_X[i - 1]).toBeCloseTo(254 / 9, 10);
  });

  it("maps gains to y: 0 dB at 78, +1 dB 6.2 units up, -1 dB 6.2 down", () => {
    const pts = curvePoints([0, 1, -1, 9, -2.4, 0, 0, 0, 0, 0]);
    expect(pts[0][1]).toBe(78);
    expect(pts[1][1]).toBeCloseTo(71.8, 10);
    expect(pts[2][1]).toBeCloseTo(84.2, 10);
    expect(pts[3][1]).toBeCloseTo(78 - 55.8, 10);
    expect(pts[4][1]).toBeCloseTo(78 + 14.88, 10);
    pts.forEach((p, i) => expect(p[0]).toBe(BAND_X[i]));
  });

  it("scales every gain toward 0 dB with the switch amount", () => {
    const bass = presetById("bass").db;
    curvePoints(bass, 0).forEach((p) => expect(p[1]).toBe(78));
    curvePoints(bass, 0.5).forEach((p, i) => expect(p[1]).toBeCloseTo(78 - bass[i] * 6.2 * 0.5, 10));
  });

  it("rejects a gain list of the wrong length", () => {
    expect(() => curvePoints([1, 2, 3])).toThrow(/expected 10 gains/);
  });

  it("keeps the extreme presets inside the drawing area", () => {
    for (const p of PRESETS) {
      for (const [, y] of curvePoints(p.db)) {
        expect(y).toBeGreaterThan(GRAPH.TOP);
        expect(y).toBeLessThan(GRAPH.BOTTOM);
      }
    }
  });
});

describe("curvePath (Catmull Rom as cubic Beziers)", () => {
  it("returns an empty path for no points and a lone move for one", () => {
    expect(curvePath([])).toBe("");
    expect(curvePath([[5, 6]])).toBe("M5,6");
  });

  it("writes one cubic segment per span between bands", () => {
    const { segs } = parsePath(pathFor(presetById("club").db));
    expect(segs).toHaveLength(9);
  });

  it("passes exactly through every band point", () => {
    for (const p of PRESETS) {
      const pts = curvePoints(p.db);
      const { start, segs } = parsePath(curvePath(pts));
      expect(start[0]).toBeCloseTo(pts[0][0], 2);
      expect(start[1]).toBeCloseTo(pts[0][1], 2);
      segs.forEach((s, i) => {
        expect(s[4]).toBeCloseTo(pts[i + 1][0], 2);
        expect(s[5]).toBeCloseTo(pts[i + 1][1], 2);
      });
    }
  });

  it("uses control points p1 + (p2 - p0) / 6 and p2 - (p3 - p1) / 6", () => {
    const pts: Point[] = [
      [0, 0],
      [10, 30],
      [20, 0],
      [30, 60],
    ];
    const { segs } = parsePath(curvePath(pts));
    // middle span 10,30 -> 20,0: p0 = 0,0 and p3 = 30,60
    expect(segs[1]).toEqual([10 + 20 / 6, 30 + 0 / 6, 20 - 20 / 6, 0 - 30 / 6, 20, 0].map((v) => Math.round(v * 100) / 100));
  });

  it("repeats the end point as the missing neighbour at both ends", () => {
    const pts: Point[] = [
      [0, 0],
      [12, 6],
      [24, 0],
    ];
    const { segs } = parsePath(curvePath(pts));
    // first span: p0 = p1 = 0,0, so c1 = p1 + (p2 - p1) / 6
    expect(segs[0][0]).toBe(2);
    expect(segs[0][1]).toBe(1);
    // last span: p3 = p2 = 24,0, so c2 = p2 - (p2 - p1) / 6
    expect(segs[1][2]).toBe(22);
    expect(segs[1][3]).toBe(1);
  });

  it("draws a flat curve as a straight line along 0 dB", () => {
    const d = pathFor(new Array(10).fill(0));
    const { segs } = parsePath(d);
    segs.forEach((s) => {
      expect(s[1]).toBe(78);
      expect(s[3]).toBe(78);
      expect(s[5]).toBe(78);
    });
  });

  it("is smooth: the tangent is continuous at every interior band", () => {
    const { start, segs } = parsePath(pathFor(presetById("vocal").db));
    let prevEnd = start;
    segs.slice(0, -1).forEach((s, i) => {
      const next = segs[i + 1];
      // incoming tangent (end - c2) and outgoing tangent (c1' - end) are parallel and equal (C1 continuity)
      const inX = s[4] - s[2], inY = s[5] - s[3];
      const outX = next[0] - s[4], outY = next[1] - s[5];
      expect(inX).toBeCloseTo(outX, 1);
      expect(inY).toBeCloseTo(outY, 1);
      prevEnd = [s[4], s[5]];
    });
    expect(prevEnd).toBeDefined();
  });

  it("stays near the band points between them (no wild overshoot)", () => {
    const pts = curvePoints(presetById("xbass").db);
    const { start, segs } = parsePath(curvePath(pts));
    let p = start;
    segs.forEach((s, i) => {
      const lo = Math.min(pts[i][1], pts[i + 1][1]) - 6, hi = Math.max(pts[i][1], pts[i + 1][1]) + 6;
      for (let t = 0; t <= 1; t += 0.1) {
        const y = bez(p[1], s[1], s[3], s[5], t);
        expect(y).toBeGreaterThanOrEqual(lo);
        expect(y).toBeLessThanOrEqual(hi);
      }
      p = [s[4], s[5]];
    });
  });

  it("rounds to two decimals and never prints -0", () => {
    const d = pathFor(presetById("jazz").db);
    for (const n of d.match(/-?[\d.]+/g)!) expect(n.split(".")[1]?.length ?? 0).toBeLessThanOrEqual(2);
    expect(d).not.toMatch(/-0(?![.\d])/);
  });

  it("is deterministic, so the server and client render the same markup", () => {
    expect(pathFor(presetById("bass").db)).toBe(pathFor(presetById("bass").db));
  });

  it("closes the fill down to the graph floor", () => {
    expect(fillPathFor("M23,78 C1,2 3,4 277,78")).toBe("M23,78 C1,2 3,4 277,78 L277,122 L23,122 Z");
  });
});

describe("lineLook", () => {
  it("is solid orange when on", () => {
    expect(lineLook(1)).toEqual({ stroke: "#FF6500", lineOpacity: 1, fillOpacity: 1 });
  });
  it("is a faint white line with no fill when flat", () => {
    expect(lineLook(0)).toEqual({ stroke: "rgba(255,255,255,.4)", lineOpacity: 0.45, fillOpacity: 0 });
  });
  it("switches colour just above 2 %", () => {
    expect(lineLook(0.02).stroke).toBe("rgba(255,255,255,.4)");
    expect(lineLook(0.021).stroke).toBe("#FF6500");
  });
});

describe("the sweep", () => {
  it("lasts 0.55 s", () => {
    expect(SWEEP_S).toBe(0.55);
  });

  it("eases out (cubic)", () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.5)).toBeCloseTo(0.875, 10);
    expect(easeOut(0.25)).toBeGreaterThan(0.25);
  });

  it("clamps progress before the start and after the end", () => {
    expect(sweepProgress(-1)).toBe(0);
    expect(sweepProgress(0)).toBe(0);
    expect(sweepProgress(0.55)).toBe(1);
    expect(sweepProgress(10)).toBe(1);
    expect(sweepProgress(Infinity)).toBe(1);
    expect(sweepProgress(0.275)).toBeCloseTo(0.875, 10);
  });

  it("treats a sweep that never started (t0 = -Infinity) as finished", () => {
    expect(sweepProgress((1000 - -Infinity) / 1000)).toBe(1);
  });

  it("starts with the clip just left of the first band, the edge hidden and the ghost at 32 %", () => {
    expect(sweepFrame(0)).toEqual({ clipW: 19, edgeX: 19, edgeOpacity: 0, ghostOpacity: 0.32 });
  });

  it("ends with the clip open to the full width and the ghost and edge gone", () => {
    expect(sweepFrame(1)).toEqual({ clipW: 300, edgeX: 281, edgeOpacity: 0, ghostOpacity: 0 });
  });

  it("moves the edge left to right, fading, with the clip on it", () => {
    const a = sweepFrame(0.25), b = sweepFrame(0.75);
    expect(b.edgeX).toBeGreaterThan(a.edgeX);
    expect(a.clipW).toBe(a.edgeX);
    expect(a.edgeOpacity).toBeCloseTo(0.55 * 0.75, 10);
    expect(b.edgeOpacity).toBeLessThan(a.edgeOpacity);
    expect(sweepFrame(0.5).edgeX).toBe(150);
  });

  it("fades the ghost from 32 % toward 12.8 % as the sweep passes, then hides it", () => {
    expect(sweepFrame(0.5).ghostOpacity).toBeCloseTo(0.32 * 0.7, 10);
    expect(sweepFrame(0.999).ghostOpacity).toBeCloseTo(0.32 * 0.4, 3);
    expect(sweepFrame(1).ghostOpacity).toBe(0);
  });
});

describe("approach (the switch flattening)", () => {
  it("moves 18 % of the way per 60 fps frame, like the reference", () => {
    expect(SWITCH_RATE).toBe(0.18);
    expect(approach(1, 0, 1 / 60)).toBeCloseTo(0.82, 10);
    expect(approach(0, 1, 1 / 60)).toBeCloseTo(0.18, 10);
  });

  it("is frame rate independent: two 120 Hz frames equal one 60 Hz frame", () => {
    expect(approach(approach(1, 0, 1 / 120), 0, 1 / 120)).toBeCloseTo(approach(1, 0, 1 / 60), 10);
  });

  it("snaps to the target once within epsilon, so the animation loop can stop", () => {
    expect(approach(SWITCH_EPS / 2, 0, 1 / 60)).toBe(0);
    let v = 1;
    let frames = 0;
    while (v !== 0 && frames < 1000) {
      v = approach(v, 0, 1 / 60);
      frames++;
    }
    expect(v).toBe(0);
    expect(frames).toBeLessThan(60);
  });

  it("does not move with a zero or negative dt", () => {
    expect(approach(0.5, 1, 0)).toBe(0.5);
    expect(approach(0.5, 1, -1)).toBe(0.5);
  });

  it("stays at the target", () => {
    expect(approach(1, 1, 1 / 60)).toBe(1);
  });

  it("never overshoots even after a long stall", () => {
    expect(approach(1, 0, 10)).toBe(0);
  });
});

describe("headphone settings", () => {
  it("has the two switches, both off to start", () => {
    expect(SETTINGS.map((s) => s.label)).toEqual(["Max Volume Limiter", "Voice Prompt"]);
    expect(DEFAULT_SETTINGS).toEqual({ lim: false, voice: false });
  });

  it("labels the chips with the on and off state", () => {
    expect(settingChip("lim", false)).toBe("Max Volume Limiter: Off");
    expect(settingChip("lim", true)).toBe("Max Volume Limiter: On");
    expect(settingChip("voice", true)).toBe("Voice Prompt: On");
    expect(settingChip("voice", false)).toBe("Voice Prompt: Off");
  });

  it("throws on an unknown setting", () => {
    expect(() => settingChip("bass" as "lim", true)).toThrow(/unknown setting/);
  });
});

describe("power off state machine", () => {
  it("powers off from the question and resets after 3.2 s", () => {
    expect(powerStep("ask", "off")).toEqual({ state: "off", resetMs: 3200 });
  });

  it("cancels from the question and comes back after 0.9 s", () => {
    expect(powerStep("ask", "cancel")).toEqual({ state: "cancel", resetMs: 900 });
  });

  it("ignores every press while off or dipping away", () => {
    expect(powerStep("off", "off")).toBeNull();
    expect(powerStep("off", "cancel")).toBeNull();
    expect(powerStep("cancel", "off")).toBeNull();
    expect(powerStep("cancel", "cancel")).toBeNull();
  });

  it("exposes the reset times", () => {
    expect(POWER_RESET_MS).toEqual({ off: 3200, cancel: 900 });
  });
});

describe("sound cues (sound.js)", () => {
  it("confirm 0.4 on a preset pick and a settings toggle, collapse 0.5 on power off, confirm 0.3 on cancel", () => {
    expect(CUES).toEqual({
      pick: { name: "confirm", volume: 0.4 },
      toggle: { name: "confirm", volume: 0.4 },
      powerOff: { name: "collapse", volume: 0.5 },
      cancel: { name: "confirm", volume: 0.3 },
    });
  });
});
