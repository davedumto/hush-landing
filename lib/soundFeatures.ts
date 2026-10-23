// More of your Tune (#sound): pure data and math for the Equalizer, Headphone Settings and Power off cards,
// ported from hush-update-kit/reference/src/feat.js and sound.js (UPDATE_GUIDE.md section 4).
// No DOM access in this file; the cards live in components/feat/. Do not retune any number here: they are the
// reference's (the preset gains are UPDATE_GUIDE.md section 4's table, which the guide calls illustrative).

import { clamp } from "@/lib/journey";

// ---------- equalizer presets ----------

export type PresetId = "studio" | "bass" | "club" | "xbass" | "vocal" | "jazz";
export type Preset = { id: PresetId; name: string; db: readonly number[] };

/** gains in dB for the ten bands, 32 Hz to 16 kHz (UPDATE_GUIDE.md section 4) */
export const PRESETS: readonly Preset[] = [
  { id: "studio", name: "Studio", db: [1, 0.8, 0.3, 0, 0, 0, 0.2, 0.6, 1, 1.2] },
  { id: "bass", name: "Bass", db: [6.4, 6, 5.6, 4.4, 1.6, 0.5, 0.1, 0, 0, 0] },
  { id: "club", name: "Club", db: [3.4, 4.4, 3.2, 1, 0, 1.2, 2.6, 3.4, 3, 2] },
  { id: "xbass", name: "Extreme Bass", db: [9, 8.6, 7.2, 4.6, 1.4, 0.2, 0, 0, 0, 0] },
  { id: "vocal", name: "Vocal", db: [-2.4, -1.8, -0.8, 0.6, 2.6, 4.4, 4, 2, 0.4, -0.8] },
  { id: "jazz", name: "Jazz", db: [3.4, 2.4, 1.2, 2.2, -1.2, -1.4, 0, 1.2, 2.4, 3.2] },
];

/** the preset the card starts on */
export const DEFAULT_PRESET: PresetId = "bass";

/** band labels under the graph */
export const FREQ = ["32", "64", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"] as const;

/** the preset with this id; throws on an unknown id so a typo can never silently draw a flat curve */
export function presetById(id: PresetId): Preset {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`unknown preset: ${id}`);
  return p;
}

// ---------- graph geometry ----------

/** a 300 x 150 drawing area, bands from x 23 to x 277, 0 dB at y 78, 6.2 units per dB */
export const GRAPH = {
  W: 300,
  H: 150,
  X0: 23,
  X1: 277,
  Y0: 78,
  K: 6.2,
  /** the fill under the curve closes along this y; the grid lines and sweep edge run from TOP to here */
  BOTTOM: 122,
  TOP: 10,
} as const;

/** the x of each band, evenly spaced from X0 to X1 */
export const BAND_X: readonly number[] = FREQ.map((_, i) => GRAPH.X0 + ((GRAPH.X1 - GRAPH.X0) * i) / (FREQ.length - 1));

export type Point = readonly [number, number];

/**
 * The curve's points for a set of gains. amt (0 to 1) scales every gain toward 0 dB: 1 is the full curve, 0 is
 * flat. The switch animates amt to flatten the curve.
 */
export function curvePoints(db: readonly number[], amt = 1): Point[] {
  if (db.length !== BAND_X.length) throw new Error(`expected ${BAND_X.length} gains, got ${db.length}`);
  return db.map((v, i) => [BAND_X[i], GRAPH.Y0 - v * GRAPH.K * amt] as const);
}

/** two decimals is far below a pixel in a 300 unit viewBox, and keeps the path short and stable */
const fmt = (v: number) => {
  const r = Math.round(v * 100) / 100;
  return String(Object.is(r, -0) ? 0 : r);
};

/**
 * A smooth SVG path through every point: each span p1 to p2 is the Catmull Rom segment through p0, p1, p2, p3
 * written as a cubic Bezier, with control points p1 + (p2 - p0) / 6 and p2 - (p3 - p1) / 6. At the two ends the
 * missing neighbour is the end point itself. The curve passes exactly through every point.
 */
export function curvePath(pts: readonly Point[]): string {
  if (pts.length === 0) return "";
  let d = `M${fmt(pts[0][0])},${fmt(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${fmt(c1x)},${fmt(c1y)} ${fmt(c2x)},${fmt(c2y)} ${fmt(p2[0])},${fmt(p2[1])}`;
  }
  return d;
}

/** the curve path for a set of gains at a given switch amount */
export const pathFor = (db: readonly number[], amt = 1) => curvePath(curvePoints(db, amt));

/** the curve closed down to the graph floor, for the gradient fill under it */
export const fillPathFor = (d: string) => `${d} L${GRAPH.X1},${GRAPH.BOTTOM} L${GRAPH.X0},${GRAPH.BOTTOM} Z`;

/** how the line and fill look at a switch amount: orange and solid when on, a faint white line when flat */
export function lineLook(amt: number): { stroke: string; lineOpacity: number; fillOpacity: number } {
  return { stroke: amt > 0.02 ? "#FF6500" : "rgba(255,255,255,.4)", lineOpacity: 0.45 + 0.55 * amt, fillOpacity: amt };
}

// ---------- the sweep: a preset change redraws the curve left to right, 0.55 s, ease out ----------

export const SWEEP_S = 0.55;

export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** the eased sweep progress (0 to 1) after `elapsed` seconds; before the start it is 0, after the end 1 */
export const sweepProgress = (elapsed: number, dur = SWEEP_S) => easeOut(clamp(elapsed / dur, 0, 1));

export type SweepFrame = { clipW: number; edgeX: number; edgeOpacity: number; ghostOpacity: number };

/**
 * One frame of the sweep at eased progress k. The clip that reveals the new curve grows from just left of the
 * first band to just right of the last (and opens to the full width once done); the thin edge line rides its
 * right side and fades as it goes; the ghost of the previous curve starts at 32 % and fades until the sweep ends.
 */
export function sweepFrame(k: number): SweepFrame {
  const x = GRAPH.X0 - 4 + (GRAPH.X1 - GRAPH.X0 + 8) * k;
  return {
    clipW: k >= 1 ? GRAPH.W : x,
    edgeX: x,
    edgeOpacity: k > 0 && k < 1 ? 0.55 * (1 - k) : 0,
    ghostOpacity: k >= 1 ? 0 : 0.32 * (1 - k * 0.6),
  };
}

/** the reference eases the switch amount 18 % of the way to its target every 60 fps frame */
export const SWITCH_RATE = 0.18;
/** close enough to the target to snap and stop animating */
export const SWITCH_EPS = 0.001;

/**
 * The switch amount after dt seconds heading for target. Frame rate independent: at 60 fps this is exactly the
 * reference's 18 % per frame, and a 120 Hz screen or a dropped frame lands in the same place.
 */
export function approach(cur: number, target: number, dt: number): number {
  const next = cur + (target - cur) * (1 - Math.pow(1 - SWITCH_RATE, Math.max(0, dt) * 60));
  return Math.abs(target - next) < SWITCH_EPS ? target : next;
}

// ---------- headphone settings ----------

export type SettingKey = "lim" | "voice";
export type Settings = Record<SettingKey, boolean>;

export const SETTINGS: readonly { k: SettingKey; label: string }[] = [
  { k: "lim", label: "Max Volume Limiter" },
  { k: "voice", label: "Voice Prompt" },
];

/** both switches start off, as in the reference */
export const DEFAULT_SETTINGS: Settings = { lim: false, voice: false };

/** the chip beside the card, e.g. "Max Volume Limiter: On" */
export function settingChip(k: SettingKey, on: boolean): string {
  const s = SETTINGS.find((x) => x.k === k);
  if (!s) throw new Error(`unknown setting: ${k}`);
  return `${s.label}: ${on ? "On" : "Off"}`;
}

// ---------- remote power off: asks first, then confirms ----------

export type PowerState = "ask" | "off" | "cancel";
export type PowerAction = "off" | "cancel";

/** how long each state holds before the card resets to the question */
export const POWER_RESET_MS: Record<PowerAction, number> = { off: 3200, cancel: 900 };

/**
 * The next state for a button press, and when to reset back to "ask". Only the question takes a press: while the
 * card shows the off state or is dipping away from a cancel, a stray press (a double click, a keyboard repeat)
 * returns null and changes nothing.
 */
export function powerStep(state: PowerState, action: PowerAction): { state: PowerState; resetMs: number } | null {
  if (state !== "ask") return null;
  return { state: action, resetMs: POWER_RESET_MS[action] };
}

// ---------- sound cues (sound.js), all through lib/audio's play() ----------

export const CUES = {
  pick: { name: "confirm", volume: 0.4 },
  toggle: { name: "confirm", volume: 0.4 },
  powerOff: { name: "collapse", volume: 0.5 },
  cancel: { name: "confirm", volume: 0.3 },
} as const;
