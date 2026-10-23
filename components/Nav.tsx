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
          <a
            className="launch-link nav-launch-link"
            href="https://www.producthunt.com/products/hush-bfb4bb0f-311f-49ec-b15d-ef2fed4f19e7?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-hush-f3172658-972a-4c00-8ed0-69c876f7d337"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="hush. on Product Hunt"
          >
            <img
              alt="HUSH - Control your JBL headphones without touching them. | Product Hunt"
              width={150}
              height={32}
              src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1288170&theme=light&t=1792730043848"
            />
          </a>
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
