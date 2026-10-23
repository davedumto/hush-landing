import type { ReactNode } from "react";

// The shared shell of every More of your Tune card (ported from feat.js baseView()): the black frame, the
// panel, and the dimmed JBL Tune card view behind whatever sheet the card shows. Trays are always dark in
// every theme (UPDATE_GUIDE.md section 3), so data-frame is fixed. The hf- classes are deliberately separate
// from AppCard's (.cnum, .bchip...): same look, different markup.

export type TuneModel = "670" | "770";

type FeatFrameProps = {
  model: TuneModel;
  /** extra class on the panel (the power card's hf-pw) */
  panelClass?: string;
  /** the power card's state, which its CSS keys off */
  state?: string;
  children: ReactNode;
};

export function FeatFrame({ model, panelClass, state, children }: FeatFrameProps) {
  return (
    <div className="hf-card" data-frame="dark">
      <div className={panelClass ? `hf-panel ${panelClass}` : "hf-panel"} data-st={state}>
        <div className="hf-base" aria-hidden="true">
          <div className="hf-top">
            <span className="hf-chip">
              <span className="hf-dot" />
              {model}NC
            </span>
            <span className="sp" />
            <span className="hf-cb">
              <span className="ico i-set" />
            </span>
            <span className="hf-cb">
              <span className="ico i-pow" />
            </span>
          </div>
          <div className="hf-hero">
            <div className="hf-num">{model}</div>
            <img alt="" src={`/photos/Tune${model}Black.webp`} />
            <div className="hf-bat">
              <small>BATTERY</small>
              <b>60%</b>
              <i />
            </div>
          </div>
          <div className="hf-name">JBL Tune {model}NC</div>
        </div>
        <div className="hf-dim" />
        {children}
      </div>
    </div>
  );
}

/** a sheet's title row: back chevron, title, and the close button (the plus icon turned 45 degrees) */
export function SheetHead({ title }: { title: string }) {
  return (
    <div className="hf-head">
      <span className="hf-ib" aria-hidden="true">
        <span className="ico i-down" style={{ transform: "rotate(90deg)" }} />
      </span>
      <h4>{title}</h4>
      <span className="hf-ib" aria-hidden="true">
        <span className="ico i-plus" style={{ transform: "rotate(45deg)" }} />
      </span>
    </div>
  );
}

type SwitchProps = { label: string; checked: boolean; onToggle: () => void };

/** the app's 46 x 27 switch; the knob moves on a 0.35 s overshoot (CSS) */
export function Switch({ label, checked, onToggle }: SwitchProps) {
  return (
    <button className="hf-sw" type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onToggle}>
      <i />
    </button>
  );
}
