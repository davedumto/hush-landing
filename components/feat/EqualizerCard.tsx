"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import { FeatFrame, SheetHead, Switch, type TuneModel } from "@/components/feat/FeatFrame";
import {
  BAND_X,
  DEFAULT_PRESET,
  FREQ,
  GRAPH,
  PRESETS,
  approach,
  fillPathFor,
  lineLook,
  pathFor,
  presetById,
  sweepFrame,
  sweepProgress,
  type PresetId,
} from "@/lib/soundFeatures";

// The app's Equalizer sheet over the dimmed card. Picking a preset redraws the curve with a left to right sweep
// (0.55 s, ease out); the switch flattens the curve and dims the presets. The sweep and the flatten are driven
// by a short requestAnimationFrame loop that writes SVG attributes directly (no re-render per frame) and stops
// as soon as both settle. The server render and the first client render draw the default preset fully, so
// nothing differs at hydration; the path props below are constants, so a re-render never clobbers a frame.

const INITIAL_D = pathFor(presetById(DEFAULT_PRESET).db, 1);
const INITIAL_FILL = fillPathFor(INITIAL_D);
const { W, H, X0, TOP, BOTTOM } = GRAPH;

type EqualizerCardProps = {
  model: TuneModel;
  /** the selected preset; the section owns it so the chips beside the card can mirror it */
  preset: PresetId;
  onPick: (id: PresetId) => void;
};

export default function EqualizerCard({ model, preset, onPick }: EqualizerCardProps) {
  const [on, setOn] = useState(true);
  // url(#id) references must not contain the colons / guillemets useId() can produce
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const fillId = `hfFill${uid}`, clipId = `hfClip${uid}`;

  const lineRef = useRef<SVGPathElement>(null);
  const fillRef = useRef<SVGPathElement>(null);
  const ghostRef = useRef<SVGPathElement>(null);
  const clipRef = useRef<SVGRectElement>(null);
  const edgeRef = useRef<SVGLineElement>(null);

  // animation state that must survive renders but never cause one
  const anim = useRef({
    sel: DEFAULT_PRESET as PresetId,
    cur: presetById(DEFAULT_PRESET).db,
    prev: presetById(DEFAULT_PRESET).db,
    t0: -Infinity, // ms; -Infinity means the sweep is finished
    on: true,
    amt: 1,
    last: 0,
    raf: 0,
  });

  // one frame: draw the curve at the current switch amount, then the sweep's clip, edge and ghost
  function frame(now: number, reduced: boolean) {
    const a = anim.current;
    const dt = a.last ? (now - a.last) / 1000 : 1 / 60;
    a.last = now;
    const target = a.on ? 1 : 0;
    a.amt = reduced ? target : approach(a.amt, target, dt);
    const k = reduced ? 1 : sweepProgress((now - a.t0) / 1000);

    const d = pathFor(a.cur, a.amt);
    const look = lineLook(a.amt);
    lineRef.current?.setAttribute("d", d);
    lineRef.current?.setAttribute("stroke", look.stroke);
    if (lineRef.current) lineRef.current.style.opacity = String(look.lineOpacity);
    fillRef.current?.setAttribute("d", fillPathFor(d));
    if (fillRef.current) fillRef.current.style.opacity = String(look.fillOpacity);

    const s = sweepFrame(k);
    clipRef.current?.setAttribute("width", String(s.clipW));
    ghostRef.current?.setAttribute("d", pathFor(a.prev, a.amt));
    ghostRef.current?.setAttribute("opacity", String(s.ghostOpacity));
    edgeRef.current?.setAttribute("x1", String(s.edgeX));
    edgeRef.current?.setAttribute("x2", String(s.edgeX));
    edgeRef.current?.setAttribute("opacity", String(s.edgeOpacity));

    return k < 1 || a.amt !== target;
  }

  // run frames until the sweep and the switch have both settled; reduced motion draws the end state once
  function kick() {
    const a = anim.current;
    if (a.raf) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    a.last = 0;
    const loop = (now: number) => {
      a.raf = 0;
      if (frame(now, reduced)) a.raf = requestAnimationFrame(loop);
    };
    a.raf = requestAnimationFrame(loop);
  }

  // a new preset: the old target becomes the ghost and the sweep restarts (also mid sweep, like the app)
  useEffect(() => {
    const a = anim.current;
    if (preset === a.sel) return;
    a.prev = a.cur;
    a.cur = presetById(preset).db;
    a.sel = preset;
    a.t0 = performance.now();
    kick();
    // kick only touches refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  useEffect(() => {
    const a = anim.current;
    if (on === a.on) return;
    a.on = on;
    kick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  useEffect(() => {
    const a = anim.current;
    return () => {
      cancelAnimationFrame(a.raf);
      a.raf = 0;
    };
  }, []);

  return (
    <FeatFrame model={model}>
      <section className={on ? "hf-sheet eq" : "hf-sheet eq hf-off"} aria-label="Equalizer">
        <SheetHead title="Equalizer" />
        <div className="hf-row hf-eqlabel">
          <b>Equalizer</b>
          <Switch label="Equalizer" checked={on} onToggle={() => setOn((v) => !v)} />
        </div>
        <div className="hf-graph">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#FF6500" stopOpacity=".28" />
                <stop offset="1" stopColor="#FF6500" stopOpacity="0" />
              </linearGradient>
              <clipPath id={clipId}>
                <rect ref={clipRef} x="0" y="0" width={W} height={H} />
              </clipPath>
            </defs>
            <g>
              {BAND_X.map((x) => (
                <line key={x} x1={x} x2={x} y1={TOP} y2={BOTTOM} stroke="rgba(255,255,255,.16)" strokeDasharray="2 3" />
              ))}
            </g>
            <path ref={ghostRef} d={INITIAL_D} fill="none" stroke="#FF6500" strokeWidth="2" strokeLinecap="round" opacity="0" />
            <g clipPath={`url(#${clipId})`}>
              <path ref={fillRef} d={INITIAL_FILL} fill={`url(#${fillId})`} />
              <path ref={lineRef} d={INITIAL_D} fill="none" stroke="#FF6500" strokeWidth="2.6" strokeLinecap="round" />
            </g>
            <line ref={edgeRef} x1={X0} x2={X0} y1={TOP} y2={BOTTOM} stroke="#FF6500" strokeWidth="1.5" opacity="0" />
          </svg>
          <div className="hf-freq">
            {FREQ.map((f) => (
              <span key={f}>{f}</span>
            ))}
          </div>
        </div>
        <div className="hf-pre" role="group" aria-label="Presets">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              className="hf-pb"
              type="button"
              aria-pressed={p.id === preset}
              disabled={!on}
              onClick={() => onPick(p.id)}
            >
              {p.name.split(" ").map((w, i) => (
                <Fragment key={w}>
                  {i > 0 && <br />}
                  {w}
                </Fragment>
              ))}
            </button>
          ))}
        </div>
      </section>
    </FeatFrame>
  );
}
