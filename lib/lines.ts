// Tangled-line generator and drawing for the seal and modes ("keys") canvases.
// Ported line-for-line from reference/index.html.
import { lerp, ss } from "./journey";

export type Line = { y: number; amp: number; f1: number; f2: number; ph: number; orange: boolean; a: number; sp: number };

export function makeLines(seed: number, n: number): Line[] {
  let s = seed;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const L: Line[] = [];
  for (let i = 0; i < n; i++) {
    L.push({ y: r() - 0.5, amp: 20 + r() * 60, f1: 0.004 + r() * 0.02, f2: 0.03 + r() * 0.05, ph: r() * 10, orange: r() < 0.14, a: 0.1 + r() * 0.3, sp: 0.4 + r() * 1.2 });
  }
  return L;
}

export function sizeCan(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const d = Math.min(window.devicePixelRatio || 1, 2);
  c.width = c.clientWidth * d;
  c.height = c.clientHeight * d;
  const x = c.getContext("2d")!;
  x.setTransform(d, 0, 0, d, 0, 0);
  return x;
}

export const SL = makeLines(11, 52);
export const KL = makeLines(7, 26);

export function drawSeal(
  sg: CanvasRenderingContext2D,
  sc: HTMLCanvasElement,
  t: number,
  sealP: number,
  isDark: () => boolean
): { db: number; label: string } {
  const W = sc.clientWidth, H = sc.clientHeight;
  sg.clearRect(0, 0, W, H);
  const narrow = W < 700;
  const cy = H * (narrow ? 0.36 : 0.42);
  const ax = W * (narrow ? 0.5 : 0.55);
  const aR = Math.min(W, H) * 0.2;
  const aL = ax - aR * 1.3;
  const aRt = ax + aR * 1.3;
  const dotX = narrow ? W * 0.88 : W * 0.84;
  const ty = cy + aR * 0.3;
  const conv = ss(0.18, 0.82, sealP), arch = ss(0.05, 0.45, sealP), line = ss(0.7, 0.9, sealP), pop = ss(0.86, 1, sealP), jit = 1 - conv;
  for (const L of SL) {
    const y0 = cy + L.y * H * 0.95;
    sg.beginPath();
    const xe = conv < 0.98 ? W : aRt;
    for (let x = 0; x <= xe; x += 4) {
      const p = ss(aL - W * 0.25, aRt, Math.min(x, aRt)) * conv;
      const n = (Math.sin(x * L.f1 + L.ph + t * L.sp * jit) * L.amp + Math.sin(x * L.f2 + L.ph * 2 - t * L.sp * 1.7 * jit) * L.amp * 0.35) * (1 - p);
      const y = y0 * (1 - p) + ty * p + n;
      if (x) sg.lineTo(x, y);
      else sg.moveTo(x, y);
    }
    const dk = isDark();
    sg.strokeStyle = L.orange
      ? `rgba(255,101,0,${(0.3 + L.a) * (1 - conv * 0.6)})`
      : dk
        ? `rgba(220,232,246,${L.a * (1 - conv * 0.55)})`
        : `rgba(11,25,44,${L.a * 0.8 * (1 - conv * 0.55)})`;
    sg.lineWidth = L.orange ? 2 : 1.3;
    sg.stroke();
  }
  if (line > 0) {
    sg.beginPath();
    sg.moveTo(aRt - 20, ty);
    sg.lineTo(lerp(aRt - 20, dotX, line), ty);
    sg.strokeStyle = isDark() ? "rgba(255,255,255,.92)" : "#1E3E62";
    sg.lineWidth = 3;
    sg.stroke();
  }
  if (arch > 0) {
    sg.save();
    sg.beginPath();
    sg.arc(ax, ty, aR, Math.PI, Math.PI + Math.PI * arch);
    sg.strokeStyle = isDark() ? "#fff" : "#1E3E62";
    sg.lineWidth = aR * 0.32;
    sg.lineCap = "round";
    sg.shadowColor = isDark() ? "rgba(0,0,0,.5)" : "rgba(30,62,98,.25)";
    sg.shadowBlur = 40;
    sg.stroke();
    sg.restore();
  }
  if (pop > 0) {
    const k = pop < 0.7 ? (pop / 0.7) * 1.18 : 1.18 - ((pop - 0.7) / 0.3) * 0.18;
    const r = aR * 0.13 * k;
    const gr = sg.createRadialGradient(dotX, ty, 0, dotX, ty, r * 6);
    gr.addColorStop(0, `rgba(255,101,0,${0.55 * pop})`);
    gr.addColorStop(1, "rgba(255,101,0,0)");
    sg.fillStyle = gr;
    sg.fillRect(dotX - r * 6, ty - r * 6, r * 12, r * 12);
    sg.beginPath();
    sg.arc(dotX, ty, r, 0, Math.PI * 2);
    sg.fillStyle = "#FF6500";
    sg.fill();
  }
  const db = Math.round(lerp(78, 24, ss(0.1, 0.88, sealP)));
  const label = sealP > 0.88 ? "ANC on" : "Scroll to turn ANC on";
  return { db, label };
}

export type KeysVelocity = { chaos: number; orange: number };
export const KT: Record<string, KeysVelocity> = {
  off: { chaos: 1, orange: 0.15 },
  anc: { chaos: 0.04, orange: 0.9 },
  amb: { chaos: 0.45, orange: 0.4 },
  talk: { chaos: 0.22, orange: 0.65 },
};

export function drawKeys(
  kg: CanvasRenderingContext2D,
  kc: HTMLCanvasElement,
  t: number,
  kv: KeysVelocity,
  kt: KeysVelocity,
  isDark: () => boolean
) {
  kv.chaos = lerp(kv.chaos, kt.chaos, 0.05);
  kv.orange = lerp(kv.orange, kt.orange, 0.05);
  const W = kc.clientWidth, H = kc.clientHeight;
  kg.clearRect(0, 0, W, H);
  const cy = H / 2, dark = isDark();
  for (const L of KL) {
    kg.beginPath();
    for (let x = 0; x <= W; x += 6) {
      const n = (Math.sin(x * L.f1 + L.ph + t * L.sp) * L.amp * 1.6 + Math.sin(x * L.f2 + L.ph * 2 - t * L.sp * 1.7) * L.amp * 0.6) * kv.chaos;
      const y = lerp(cy, cy + L.y * H * 0.9, kv.chaos) + n;
      if (x) kg.lineTo(x, y);
      else kg.moveTo(x, y);
    }
    kg.strokeStyle = L.orange ? `rgba(255,101,0,${0.12 + 0.3 * kv.orange})` : dark ? `rgba(220,232,246,${L.a * 0.35})` : `rgba(11,25,44,${L.a * 0.3})`;
    kg.lineWidth = L.orange ? 1.6 : 1;
    kg.stroke();
  }
}
