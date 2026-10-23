"use client";

import { useEffect, useRef, useState } from "react";
import { FeatFrame, type TuneModel } from "@/components/feat/FeatFrame";
import { powerStep, type PowerAction, type PowerState } from "@/lib/soundFeatures";

// Remote power off: the dimmed card with a confirmation sheet. Power off swaps the sheet for the off state and
// greys the card behind, then resets after 3.2 s; Cancel dips the sheet away and brings it back after 0.9 s.
// Nothing is sent anywhere: this is a demo. The transitions themselves are CSS, keyed off data-st.

type PowerCardProps = {
  model: TuneModel;
  onOff: () => void;
  onCancel: () => void;
};

export default function PowerCard({ model, onOff, onCancel }: PowerCardProps) {
  const [state, setState] = useState<PowerState>("ask");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const name = `JBL Tune ${model}NC`;

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  function press(action: PowerAction) {
    const next = powerStep(state, action);
    if (!next) return;
    setState(next.state);
    if (action === "off") onOff();
    else onCancel();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      setState("ask");
    }, next.resetMs);
  }

  const asking = state === "ask";
  return (
    <FeatFrame model={model} panelClass="hf-pw" state={state}>
      {/* inert while it is slid away, so its buttons cannot be tabbed to or clicked off screen */}
      <section className="hf-sheet hf-ask" aria-label="Power off" inert={!asking}>
        <div className="hf-pico">
          <span className="ico i-pow" />
        </div>
        <h4 className="hf-ptitle">Power off?</h4>
        <p className="hf-ptext">This will power off {name} remotely.</p>
        <div className="hf-pbtns">
          <button className="hf-btn" type="button" onClick={() => press("cancel")}>
            Cancel
          </button>
          <button className="hf-btn hot" type="button" onClick={() => press("off")}>
            Power off
          </button>
        </div>
      </section>
      <section className="hf-sheet hf-done" aria-live="polite" aria-hidden={state !== "off"}>
        <div className="hf-pico ok">
          <span className="ico i-pow" />
        </div>
        <h4 className="hf-ptitle">{name} is off</h4>
        <p className="hf-ptext">Sent from your Mac. Turn them on with the button on the earcup.</p>
      </section>
    </FeatFrame>
  );
}
