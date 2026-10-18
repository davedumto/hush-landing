"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import AppCard, { type CardState } from "./AppCard";
import { play } from "@/lib/audio";

export type ExperienceNodes = {
  hero: HTMLElement | null;
  gL: HTMLSpanElement | null;
  gR: HTMLSpanElement | null;
  gDot: HTMLSpanElement | null;
  gGap: HTMLSpanElement | null;
  chapNum: HTMLDivElement | null;
  anchor: HTMLElement | null;
  island: HTMLButtonElement | null;
  laptopEl: HTMLDivElement | null;
  baseEl: HTMLDivElement | null;
  lidEl: HTMLDivElement | null;
  macEl: HTMLElement | null;
  screenEl: HTMLDivElement | null;
  screenInEl: HTMLDivElement | null;
  stageCanvas: HTMLCanvasElement | null;
  sealCanvas: HTMLCanvasElement | null;
};

export type ExperienceHandle = {
  getNodes: () => ExperienceNodes;
  setLapStep: (n: number) => void;
  setChapStep: (n: number) => void;
  setRulerValue: (db: number) => void;
  setSealReadout: (db: number, label: string) => void;
  setSoundAskPressed: (on: boolean) => void;
};

type ExperienceProps = {
  onSoundAskClick: () => void;
};

const Experience = forwardRef<ExperienceHandle, ExperienceProps>(function Experience({ onSoundAskClick }, ref) {
  const heroRef = useRef<HTMLElement>(null);
  const gLRef = useRef<HTMLSpanElement>(null);
  const gRRef = useRef<HTMLSpanElement>(null);
  const gDotRef = useRef<HTMLSpanElement>(null);
  const gGapRef = useRef<HTMLSpanElement>(null);
  const chapNumRef = useRef<HTMLDivElement>(null);
  const laptopRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLElement>(null);
  const islandRef = useRef<HTMLButtonElement>(null);
  const lidRef = useRef<HTMLDivElement>(null);
  const macRef = useRef<HTMLElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const screenInRef = useRef<HTMLDivElement>(null);
  const dockCardRef = useRef<HTMLDivElement>(null);
  const sealCanvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLCanvasElement>(null);
  const rulerValRef = useRef<HTMLElement>(null);
  const sealDbRef = useRef<HTMLElement>(null);
  const sealEbRef = useRef<HTMLDivElement>(null);
  const soundAskRef = useRef<HTMLButtonElement>(null);
  const soundAskLabelRef = useRef<HTMLSpanElement>(null);

  const [cardState, setCardState] = useState<CardState>({ mode: "anc", pending: null, note: "" });
  // S mirrors cardState synchronously (the reference reads/writes its S object
  // immediately within pick()/setLapStep(), ahead of React's state commit).
  const S = useRef<CardState>({ mode: "anc", pending: null, note: "" });
  const pendingTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [lapStep, setLapStepState] = useState(0);
  const [chapStep, setChapStepState] = useState(0);
  const prevLapStep = useRef(0);

  function setS(next: CardState) {
    S.current = next;
    setCardState(next);
  }

  function pick(k: string, fast?: boolean) {
    if (S.current.pending || S.current.mode === k) return;
    clearTimeout(pendingTimeout.current);
    setS({ ...S.current, pending: k, note: "" });
    pendingTimeout.current = setTimeout(
      () => {
        setS({ mode: k, pending: null, note: k === "amb" ? "unv" : "" });
        play(k === "off" ? "off" : k, 0.7);
      },
      fast ? 900 : 1200
    );
  }

  useImperativeHandle(ref, () => ({
    getNodes: () => ({
      hero: heroRef.current,
      gL: gLRef.current,
      gR: gRRef.current,
      gDot: gDotRef.current,
      gGap: gGapRef.current,
      chapNum: chapNumRef.current,
      anchor: anchorRef.current,
      island: islandRef.current,
      laptopEl: laptopRef.current,
      baseEl: baseRef.current,
      lidEl: lidRef.current,
      macEl: macRef.current,
      screenEl: screenRef.current,
      screenInEl: screenInRef.current,
      stageCanvas: stageRef.current,
      sealCanvas: sealCanvasRef.current,
    }),
    setLapStep: (n) => {
      if (n === prevLapStep.current && n === lapStep) return;
      const prev = prevLapStep.current;
      prevLapStep.current = n;
      setLapStepState(n);
      const card = dockCardRef.current;
      const open = n >= 2 && n <= 4;
      const was = card?.classList.contains("open") ?? false;
      card?.classList.toggle("open", open);
      if (open && !was) play("expand", 0.5);
      if (!open && was && n > 4) play("collapse", 0.5);

      if (n === 3 && prev < 3) {
        clearTimeout(pendingTimeout.current);
        setS({ mode: "anc", pending: null, note: "" });
        pendingTimeout.current = setTimeout(() => pick("amb", true), 350);
      } else if (n === 3) {
        clearTimeout(pendingTimeout.current);
        setS({ mode: "amb", pending: null, note: "unv" });
      } else if (n === 4 && prev < 4) {
        clearTimeout(pendingTimeout.current);
        setS({ mode: "amb", pending: null, note: S.current.note });
        pendingTimeout.current = setTimeout(() => pick("anc", true), 300);
      } else if (n < 3) {
        clearTimeout(pendingTimeout.current);
        setS({ mode: "anc", pending: null, note: "" });
      }
    },
    setChapStep: (n) => setChapStepState(n),
    setRulerValue: (db) => {
      if (rulerValRef.current) rulerValRef.current.textContent = String(db);
    },
    setSealReadout: (db, label) => {
      if (sealDbRef.current) sealDbRef.current.textContent = `${db} dB`;
      if (sealEbRef.current) sealEbRef.current.textContent = label;
    },
    setSoundAskPressed: (on) => {
      soundAskRef.current?.setAttribute("aria-pressed", String(on));
      if (soundAskLabelRef.current) {
        soundAskLabelRef.current.textContent = on ? "Sound on. Scroll to hear it go quiet" : "Turn sound on and hear it go quiet";
      }
    },
  }));

  const steps = [
    {
      k: "Step 1",
      t: "Open your Mac",
      h: (
        <>
          Your headphones, <em>meet</em> your Mac<span className="o">.</span>
        </>
      ),
      p: "hush. connects to your Tune and moves its controls onto your screen.",
    },
    {
      k: "Step 2",
      t: "The island",
      h: (
        <>
          They become a <em>small circle</em> on the edge<span className="o">.</span>
        </>
      ),
      p: "Your headphones and their battery as a thin orange bar. Nothing else.",
    },
    {
      k: "Step 3",
      t: "One click",
      h: (
        <>
          The island opens into <em>the card</em>
          <span className="o">.</span>
        </>
      ),
      p: "Model, battery, connection and the four noise modes in one place.",
    },
    {
      k: "Step 4",
      t: "Pick a mode",
      h: (
        <>
          Your headphones <em>confirm</em> it<span className="o">.</span>
        </>
      ),
      p: "The ring fills while hush. waits. Orange only appears once they say yes.",
    },
    {
      k: "Step 5",
      t: "Back to quiet",
      h: (
        <>
          ANC, <em>on</em>
          <span className="o">.</span>
        </>
      ),
      p: "Switch as often as you like. The headphones always have the last word.",
    },
    {
      k: "Step 6",
      t: "Click away",
      h: (
        <>
          It <em>tucks back</em> in<span className="o">.</span>
        </>
      ),
      p: "Click anywhere else and the card folds back into the island.",
    },
    {
      k: "Step 7",
      t: "Try it",
      h: (
        <>
          Now it lives <em>on this page</em> too<span className="o">.</span>
        </>
      ),
      p: "Look at the left edge. Click the island for sound, theme and shortcuts.",
    },
  ];

  const chapterPanels = [
    {
      mono: "Chapter 1 of 3  Hands free",
      h: (
        <>
          Stop reaching for <em>your headphones</em>
          <span className="o">.</span>
        </>
      ),
      body: <p>The buttons live on the earcup. Your hands live on the keyboard. hush. puts the controls where your hands already are.</p>,
    },
    {
      mono: "Chapter 2 of 3  Noise control",
      h: (
        <>
          Every mode, <em>one click</em> on your Mac<span className="o">.</span>
        </>
      ),
      body: (
        <div className="chips">
          <span>
            <i className="ico i-off" />
            Off
          </span>
          <span className="hot">
            <i className="ico i-anc" />
            ANC
          </span>
          <span>
            <i className="ico i-amb" />
            Ambient
          </span>
          <span>
            <i className="ico i-talk" />
            TalkThru
          </span>
        </div>
      ),
    },
    {
      mono: "Chapter 3 of 3  Battery and status",
      h: (
        <>
          Battery, <em>always</em> in sight<span className="o">.</span>
        </>
      ),
      body: (
        <>
          <p>A thin orange bar on the edge of your screen. Know before they run out.</p>
          <div className="mini">
            <span className="pisl" aria-hidden="true">
              <img src="/photos/Tune770White-sm.webp" alt="" />
              <span className="bar">
                <i />
              </span>
            </span>
            <b>82%</b>
          </div>
        </>
      ),
    },
  ];

  return (
    <>
      <div className="ruler" id="ruler" aria-hidden="true">
        <div className="cap">dB</div>
        <div className="ind" id="rInd">
          <b id="rVal" ref={rulerValRef as React.RefObject<HTMLElement>}>
            78
          </b>
          <i />
        </div>
      </div>
      <canvas id="stage" aria-hidden="true" ref={stageRef} />

      <section className="scene" id="hero" data-n="01" data-t="The turn" aria-label="hush." ref={heroRef}>
        <div className="hero-cap mono">
          <span className="r">For macOS 14 and later</span>
        </div>
        <div className="word" aria-hidden="true">
          <span id="gL" ref={gLRef}>
            hu
          </span>
          <span className="gap" id="gGap" ref={gGapRef} />
          <span id="gR" ref={gRRef}>
            sh
            <span className="pd" id="gDot" ref={gDotRef}>
              .
            </span>
          </span>
        </div>
        <h1 className="sr" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
          hush.
        </h1>
        <div className="hero-foot">
          <p className="tag">Control your headphones without touching them.</p>
          <div className="act">
            <a className="cta big" href="https://github.com/davedumto/Hush/releases" target="_blank" rel="noopener noreferrer">
              <img className="appi" src="/brand/app-icon-96.png" alt="" />
              Download for Mac
            </a>
            <span className="mono">Supports JBL Tune 770NC &amp; 670NC, more models coming</span>
          </div>
        </div>
        <div className="scroll-cue mono" aria-hidden="true">
          Scroll<i />
        </div>
      </section>

      <section className="scene" id="chapters" data-n="02" data-t="The remote" aria-label="The remote">
        <div className="chap-num" id="chapNum" aria-hidden="true" ref={chapNumRef}>
          770
        </div>
        <div className="pager" id="pager" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <i key={i} className={i === chapStep ? "on" : undefined} />
          ))}
        </div>
        <div className="chap-copy">
          {chapterPanels.map((p, i) => (
            <div className={`cp${i === chapStep ? " on" : ""}`} key={i}>
              <div className="mono">{p.mono}</div>
              <h2>{p.h}</h2>
              {p.body}
            </div>
          ))}
        </div>
        <div className="stats mono" aria-label="hush. in numbers">
          <div>
            <b>4</b>noise modes
          </div>
          <div>
            <b>2</b>Tune models
          </div>
          <div>
            <b>1</b>click away
          </div>
        </div>
      </section>

      <section className="scene" id="mac" data-n="03" data-t="The island" aria-label="How it works" ref={macRef}>
        <div>
          <div className="steps" id="steps">
            {steps.map((s, i) => (
              <div className={`step${i === lapStep ? " on" : ""}`} key={i}>
                <div className="mono">
                  {s.k} &nbsp;{s.t}
                </div>
                <h2>{s.h}</h2>
                <p>{s.p}</p>
              </div>
            ))}
          </div>
          <div className="sdots" id="sdots" aria-hidden="true">
            {steps.map((_, i) => (
              <i key={i} className={i === lapStep ? "on" : undefined} />
            ))}
          </div>
        </div>
        <div className="laptop" id="laptop" ref={laptopRef}>
          <div className="lid" id="lid" ref={lidRef}>
            <div className="bezel">
              <div className="screen" id="screen" ref={screenRef}>
                <div className="screen-in" id="screenIn" ref={screenInRef}>
                  <div className="wall" />
                  <div className="mbar">
                    <b>Finder</b>
                    <span>File</span>
                    <span>Edit</span>
                    <span>View</span>
                    <span>Go</span>
                    <span className="sp" />
                    <span>Sun 18 Oct&nbsp; 9:41</span>
                  </div>
                  <div className="notch" />
                  <i className="isl-anchor" id="anchor" ref={anchorRef} />
                  <button
                    className="island"
                    id="island"
                    type="button"
                    aria-label="JBL Tune 770NC, 82% battery. Open controls"
                    ref={islandRef}
                  >
                    <img alt="" src="/photos/Tune770White-sm.webp" />
                    <span className="bar">
                      <i />
                    </span>
                  </button>
                  <AppCard state={cardState} onPick={pick} ref={dockCardRef} />
                </div>
              </div>
            </div>
          </div>
          <div className="base" aria-hidden="true" ref={baseRef} />
        </div>
      </section>

      <section className="scene" id="seal" data-n="04" data-t="The quiet" aria-label="The quiet">
        <canvas id="sealc" aria-hidden="true" ref={sealCanvasRef} />
        <div className="seal-meter" aria-hidden="true">
          <b id="sealDb" ref={sealDbRef as React.RefObject<HTMLElement>}>
            78 dB
          </b>
          <span className="mono">Around you</span>
        </div>
        <div className="seal-copy">
          <div className="mono" id="sealEb" ref={sealEbRef}>
            Scroll to turn ANC on
          </div>
          <h2>
            The world, <em>minus</em> the noise<span className="o">.</span>
          </h2>
          <p>One click on the island and your headphones close the door on the room. hush. waits for them to confirm before anything turns orange.</p>
          <button className="sound-ask" id="soundAsk" type="button" aria-pressed="false" ref={soundAskRef} onClick={onSoundAskClick}>
            <span className="ico i-amb" />
            <span ref={soundAskLabelRef}>Turn sound on and hear it go quiet</span>
          </button>
        </div>
      </section>
    </>
  );
});

export default Experience;
