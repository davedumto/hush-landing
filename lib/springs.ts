// CSS linear() easings sampled from the app's own tray springs (see UPDATE_GUIDE.md section 3).
// Underdamped (zeta < 1): x(t) = 1 - e^(-zeta*omega*t) * (cos(omega_d*t) + (zeta*omega/omega_d) * sin(omega_d*t))
// Critically damped (zeta = 1): x(t) = 1 - e^(-omega*t) * (1 + omega*t)

function sampleSpring(responseSeconds: number, damping: number, points = 61): number[] {
  const omega = (2 * Math.PI) / responseSeconds;
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    const t = (i / (points - 1)) * responseSeconds;
    let x: number;
    if (damping >= 1) {
      x = 1 - Math.exp(-omega * t) * (1 + omega * t);
    } else {
      const omegaD = omega * Math.sqrt(1 - damping * damping);
      x = 1 - Math.exp(-damping * omega * t) * (Math.cos(omegaD * t) + ((damping * omega) / omegaD) * Math.sin(omegaD * t));
    }
    out.push(x);
  }
  // normalise so the curve ends exactly at 1
  const last = out[out.length - 1];
  return last !== 0 ? out.map((v) => v / last) : out;
}

function toLinearEasing(samples: number[]): string {
  return `linear(${samples.map((v) => v.toFixed(4)).join(",")})`;
}

export function traySprings() {
  return {
    open: toLinearEasing(sampleSpring(0.42, 0.78)), // ~460ms, ~3% overshoot
    close: toLinearEasing(sampleSpring(0.28, 1.0)), // ~280ms, no overshoot
  };
}
