// The journey: a single pair of headphones, keyframed against scroll.
// Ported line-for-line from reference/index.html — do not round, retune or "improve" any number here.

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const ss = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// cubic in-out, used for the island flyer
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// half linear, half sine: soft but never stops at a keyframe
export const glide = (t: number) => lerp(t, (1 - Math.cos(Math.PI * t)) / 2, 0.5);

export type StageState = { x: number; y: number; h: number; f: number; o: number };

export type Rect = { x: number; y: number; w: number; h: number };

export function rc(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}

export function chapPos(f: number, innerWidth: number, innerHeight: number, navH: number): StageState {
  const W = innerWidth, top = navH, h = innerHeight - navH, narrow = W < 820;
  return narrow
    ? { x: W / 2, y: top + h * 0.3, h: Math.min(h * 0.34, W * 0.62), f, o: 1 }
    : { x: W * 0.66, y: top + h * 0.47, h: Math.min(h * 0.6, W * 0.36), f, o: 1 };
}

export function screenPos(f: number, laptopEl: Element, baseEl: Element): StageState {
  // where the open screen sits, read from boxes the lid rotation never touches
  const l = laptopEl.getBoundingClientRect();
  const b = baseEl.getBoundingClientRect();
  const top = l.top, bot = b.top, hh = Math.max(1, bot - top);
  return { x: (l.left + l.right) / 2, y: top + hh * 0.5, h: hh * 0.56, f, o: 1 };
}

export type ScrollTriggerLike = { start: number; end: number };

export type KeyframeInputs = {
  hero: ScrollTriggerLike;
  chap: ScrollTriggerLike;
  mac: ScrollTriggerLike;
  innerWidth: number;
  innerHeight: number;
  navH: number;
  gGap: Element;
  heroEl: Element;
  anchor: Element;
  laptopEl: Element;
  baseEl: Element;
};

export type Keyframe = [number, () => StageState];

export function keyframes(inputs: KeyframeInputs): Keyframe[] {
  const { hero: h, chap: c, mac: m, innerWidth: W, gGap, heroEl, anchor, laptopEl, baseEl } = inputs;
  const Lm = m.end - m.start;
  return [
    [
      h.start,
      () => {
        const g = rc(gGap);
        const hr = heroEl.getBoundingClientRect();
        return { x: g.x, y: g.y, h: Math.min(hr.height * 0.5, W * 0.36), f: 0, o: 1 };
      },
    ],
    [
      lerp(h.start, h.end, 0.9),
      () => {
        const hr = heroEl.getBoundingClientRect();
        return {
          x: W / 2,
          y: hr.top + hr.height * (W < 700 ? 0.56 : 0.78),
          h: Math.min(hr.height * 0.3, W * (W < 700 ? 0.15 : 0.22)),
          f: 144,
          o: 1,
        };
      },
    ],
    [c.start, () => chapPos(200, inputs.innerWidth, inputs.innerHeight, inputs.navH)],
    [c.end, () => chapPos(280, inputs.innerWidth, inputs.innerHeight, inputs.navH)],
    [m.start, () => screenPos(288, laptopEl, baseEl)],
    [
      m.start + Lm * 0.12,
      () => {
        const a = rc(anchor);
        return { x: a.x, y: a.y - a.h * 0.06, h: a.h * 0.5, f: 296, o: 1 };
      },
    ],
    [
      m.start + Lm * 0.16,
      () => {
        const a = rc(anchor);
        return { x: a.x, y: a.y - a.h * 0.06, h: a.h * 0.5, f: 296, o: 0 };
      },
    ],
  ];
}

export function journey(y: number, K: Keyframe[]): StageState {
  if (y <= K[0][0]) return K[0][1]();
  if (y >= K[K.length - 1][0]) return K[K.length - 1][1]();
  for (let i = 0; i < K.length - 1; i++) {
    if (y >= K[i][0] && y <= K[i + 1][0]) {
      const t = (y - K[i][0]) / Math.max(1, K[i + 1][0] - K[i][0]);
      const e = glide(t);
      const A = K[i][1]();
      const B = K[i + 1][1]();
      const arc = i === 1 || i === 3 ? Math.sin(Math.PI * e) * -40 : 0; // the long flights travel on a slight arc
      return {
        x: lerp(A.x, B.x, e),
        y: lerp(A.y, B.y, e) + arc,
        h: lerp(A.h, B.h, e),
        f: lerp(A.f, B.f, t),
        o: lerp(A.o, B.o, t),
      };
    }
  }
  // unreachable given the bounds checks above
  return K[K.length - 1][1]();
}
