import type { MastheadRefs } from "@/lib/experienceRefs";

export default function Nav({ refs, onSoundClick }: { refs: MastheadRefs; onSoundClick: () => void }) {
  return (
    <header className="nav" id="nav">
      <div className="nav-in wrap">
        <a className="brand" href="#hero" aria-label="hush. home">
          <img className="app" src="/brand/app-icon-96.png" alt="" />
          <img className="wm th-light" src="/brand/hush-wordmark-navy.svg" alt="hush." />
          <img className="wm th-dark" src="/brand/hush-wordmark-white.svg" alt="hush." />
        </a>
        <div className="nav-r">
          <button className="tbtn mono" id="navSound" type="button" aria-pressed="false" ref={refs.navSoundBtn} onClick={onSoundClick}>
            <span className="ico i-amb" />
            <span className="lb" id="navSoundT" ref={refs.navSoundLabel}>
              Sound off
            </span>
          </button>
          <a className="cta" href="https://github.com/davedumto/Hush/releases" target="_blank" rel="noopener noreferrer">
            Download
          </a>
        </div>
      </div>
    </header>
  );
}
