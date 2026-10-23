import type { PageIslandRefs } from "@/lib/experienceRefs";

type PageIslandProps = {
  refs: PageIslandRefs;
  onToggleMenu: () => void;
  onSetSound: (on: boolean) => void;
  onSetTheme: (t: "dark" | "light") => void;
  soundOn: boolean;
  isDark: boolean;
};

export default function PageIsland({ refs, onToggleMenu, onSetSound, onSetTheme, soundOn, isDark }: PageIslandProps) {
  return (
    <>
      <div className="flyer" id="flyer" aria-hidden="true" ref={refs.flyer}>
        <img src="/photos/Tune770White-sm.webp" alt="" />
        <span className="bar">
          <i />
        </span>
      </div>

      <button
        className="pisl hide"
        id="pisl"
        type="button"
        aria-expanded="false"
        aria-controls="pmenu"
        aria-label="Open the hush. menu"
        ref={refs.pisl}
        onClick={onToggleMenu}
      >
        <img src="/photos/Tune770White-sm.webp" alt="" />
        <span className="bar">
          <i id="pbar" ref={refs.pbar as React.RefObject<HTMLElement>} style={{ width: "100%", transformOrigin: "0 50%", transform: "scaleX(0)" }} />
        </span>
      </button>

      {/* one time hint; positioned and shown by the page island driver (lib/pageIslandDriver.ts) */}
      <div className="itip" id="itip" aria-hidden="true" ref={refs.itip}>
        Drag me anywhere. Click for the menu.
      </div>

      <div className="pmenu" id="pmenu" role="dialog" aria-label="hush. menu" ref={refs.pmenu}>
        <div className="in">
          <div className="hd">
            <img src="/brand/hush-lockup-white.svg" alt="hush." />
          </div>
          <div>
            <div className="lbl">SOUND</div>
            <div className="seg2">
              <button type="button" id="sOff" aria-pressed={!soundOn} ref={refs.sOff} onClick={() => onSetSound(false)}>
                <span className="ico i-off" />
                Off
              </button>
              <button type="button" id="sOn" aria-pressed={soundOn} ref={refs.sOn} onClick={() => onSetSound(true)}>
                <span className="ico i-amb" />
                On
              </button>
            </div>
          </div>
          <div>
            <div className="lbl">APPEARANCE</div>
            <div className="seg2">
              <button type="button" id="tDark" aria-pressed={isDark} ref={refs.tDark} onClick={() => onSetTheme("dark")}>
                Dark
              </button>
              <button type="button" id="tLight" aria-pressed={!isDark} ref={refs.tLight} onClick={() => onSetTheme("light")}>
                Light
              </button>
            </div>
          </div>
          <nav aria-label="Jump to">
            <div className="lbl" style={{ marginBottom: 6 }}>
              JUMP TO
            </div>
            <a className="row" href="#chapters">
              The remote<span className="ico i-down" style={{ transform: "rotate(-90deg)", width: 14, height: 14 }} />
            </a>
            <a className="row" href="#mac">
              The island<span className="ico i-down" style={{ transform: "rotate(-90deg)", width: 14, height: 14 }} />
            </a>
            <a className="row" href="#seal">
              The quiet<span className="ico i-down" style={{ transform: "rotate(-90deg)", width: 14, height: 14 }} />
            </a>
            <a className="row" href="#why">
              Hands free<span className="ico i-down" style={{ transform: "rotate(-90deg)", width: 14, height: 14 }} />
            </a>
            <a className="row" href="#modes">
              The modes<span className="ico i-down" style={{ transform: "rotate(-90deg)", width: 14, height: 14 }} />
            </a>
            <a className="row" href="https://github.com/davedumto/Hush/releases" target="_blank" rel="noopener noreferrer">
              Download<span className="ico i-down" style={{ transform: "rotate(-90deg)", width: 14, height: 14 }} />
            </a>
          </nav>
        </div>
      </div>
    </>
  );
}
