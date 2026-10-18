"use client";

import { useState } from "react";
import type { ModesRefs } from "@/lib/experienceRefs";

type ModesProps = {
  refs: ModesRefs;
  onPickKey: (k: string) => void;
  onKeySoundOn: () => void;
  soundOn: boolean;
};

const MODES = [
  { k: "off", icon: "i-off", word: "Off", bold: "Everything comes in.", rest: "No noise control. The room, as it is." },
  { k: "anc", icon: "i-anc", word: "ANC", bold: "The world goes quiet.", rest: "Active noise cancelling, for focus, flights and trains." },
  { k: "amb", icon: "i-amb", word: "Ambient", bold: "Hear what matters.", rest: "Let the room back in without taking them off." },
  { k: "talk", icon: "i-talk", word: "TalkThru", bold: "Talk without pausing.", rest: "Keep the conversation going without taking them off." },
];

export default function Modes({ refs, onPickKey, onKeySoundOn, soundOn }: ModesProps) {
  const [pressed, setPressed] = useState("anc");

  function handleClick(k: string) {
    setPressed(k);
    onPickKey(k);
  }

  return (
    <section className="band wrap" id="modes" data-n="05" data-t="The modes" aria-label="Modes">
      <div className="head">
        <div>
          <div className="mono">Four modes</div>
          <h2>
            Choose how much of the world <em>gets in</em>
            <span className="o">.</span>
          </h2>
        </div>
        <p>Click a mode. With sound on, you hear the tone hush. plays when your headphones confirm it.</p>
      </div>

      <div id="keys" className="modegrid">
        <canvas id="keysCan" aria-hidden="true" ref={refs.keysCanvas} />
        {MODES.map((m) => (
          <button
            key={m.k}
            className="mcard"
            type="button"
            data-k={m.k}
            aria-pressed={pressed === m.k}
            onClick={() => handleClick(m.k)}
          >
            <span className={`ico mcard-ico ${m.icon}`} />
            <span className="mcard-word">{m.word}</span>
            <span className="mcard-d">
              <b>{m.bold}</b>
              {m.rest}
            </span>
          </button>
        ))}
      </div>

      <div className="keyhint mono" id="keyhint" ref={refs.keyhint} hidden={soundOn}>
        <span className="ico i-info" />
        <span>Sound is off</span>
        <button type="button" id="keySound" ref={refs.keySoundBtn} onClick={onKeySoundOn}>
          Turn it on
        </button>
      </div>
    </section>
  );
}
