"use client";

import { forwardRef } from "react";

const NAMES: Record<string, string> = { off: "Off", anc: "ANC", amb: "Ambient", talk: "TalkThru" };
const ICO: Record<string, string> = { off: "i-off", anc: "i-anc", amb: "i-amb", talk: "i-talk" };

export type CardState = { mode: string; pending: string | null; note: string };

const Ring = () => (
  <svg className="rg" viewBox="0 0 16 16" aria-hidden="true">
    <circle className="b" cx="8" cy="8" r="7" />
    <circle className="f" cx="8" cy="8" r="7" />
  </svg>
);

export function ctrlMarkup(S: CardState, onPick: (k: string) => void) {
  const keys = ["off", "anc", "amb", "talk"];
  return (
    <>
      <div className="ctrl">
        {keys.map((k) => {
          const pend = S.pending === k;
          const on = !pend && S.mode === k;
          const c = pend ? "pend" : on ? "on" : "av";
          return (
            <button
              key={k}
              className={`m ${c}`}
              type="button"
              data-mode={k}
              aria-pressed={on}
              onClick={() => onPick(k)}
            >
              {pend ? <Ring /> : <span className={`ico ${ICO[k]}`} />}
              <span className="ml">{NAMES[k]}</span>
            </button>
          );
        })}
      </div>
      <div className="cstat">
        {S.pending ? (
          <>
            <span className="cdot ring pulse" />
            <b>{NAMES[S.pending]}</b>waiting for headphones…
          </>
        ) : (
          <>
            <span className="cdot" />
            <b>{NAMES[S.mode]}</b>is currently active
          </>
        )}
      </div>
    </>
  );
}

type AppCardProps = {
  state: CardState;
  onPick: (k: string) => void;
  /** true when the tray opens up or down (row of 4 buttons); false/undefined for sideways (2x2) */
  row4?: boolean;
};

const AppCard = forwardRef<HTMLDivElement, AppCardProps>(function AppCard({ state, onPick, row4 }, ref) {
  return (
    <div className="dock-card" id="dockCard" ref={ref}>
      <div className={`card${row4 ? " row4" : ""}`}>
        <div className="cpanel">
          <div className="ctab">
            <img src="/brand/hush-mark-white.svg" alt="" />
          </div>
          <div className="ctop">
            <span className="chip">
              <span className="cdot" />
              770NC
            </span>
            <span className="sp" />
            <span className="cb">
              <span className="ico i-set" />
            </span>
            <span className="cb">
              <span className="ico i-pow" />
            </span>
          </div>
          <div className="chero">
            <div className="glow" />
            <div className="cnum">770</div>
            <button type="button" className="cplus" aria-label="Add">
              <span className="ico i-plus" />
            </button>
            <img alt="" src="/photos/Tune770Black.webp" />
            <div className="bchip">
              <small>BATTERY</small>
              <b>82%</b>
              <span className="bbar">
                <i />
              </span>
            </div>
          </div>
          <div className="cname">
            <h4>JBL Tune 770NC</h4>
            <p>
              <span className="cdot" />
              Connected
            </p>
          </div>
          <div id="cc">{ctrlMarkup(state, onPick)}</div>
          <div className="cfoot">
            <span>BLUETOOTH</span>
            <span>SYNCED</span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default AppCard;
