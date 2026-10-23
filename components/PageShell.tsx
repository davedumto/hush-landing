"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { useTheme } from "next-themes";

import Nav from "@/components/Nav";
import Experience, { type ExperienceHandle } from "@/components/Experience";
import PageIsland from "@/components/PageIsland";
import Modes from "@/components/sections/Modes";
import HandsFree from "@/components/sections/HandsFree";
import Download from "@/components/sections/Download";
import Footer from "@/components/Footer";

import { clamp, ease, journey, keyframes, lerp, rc, ss } from "@/lib/journey";
import { traySprings } from "@/lib/springs";
import { STATIC_P } from "@/lib/islandScene";
import { createIslandScene } from "@/lib/islandSceneDriver";
import { createPageIsland, type PageIslandDriver } from "@/lib/pageIslandDriver";
import { Stage3D } from "@/lib/stage3d";
import { drawSeal, drawKeys, KT, type KeysVelocity } from "@/lib/lines";
import { play, setBed, setSoundOn, isSoundOn } from "@/lib/audio";
import type { MastheadRefs, ModesRefs, PageIslandRefs } from "@/lib/experienceRefs";

export default function PageShell() {
  const { resolvedTheme, setTheme } = useTheme();

  // ---------- masthead refs ----------
  const masthead: MastheadRefs = {
    navSoundBtn: useRef<HTMLButtonElement>(null),
    navSoundLabel: useRef<HTMLSpanElement>(null),
  };

  // ---------- modes refs ----------
  const modes: ModesRefs = {
    keysCanvas: useRef<HTMLCanvasElement>(null),
    keyhint: useRef<HTMLDivElement>(null),
    keySoundBtn: useRef<HTMLButtonElement>(null),
  };

  // ---------- page island refs ----------
  const pageIsland: PageIslandRefs = {
    pisl: useRef<HTMLButtonElement>(null),
    pbar: useRef<HTMLElement>(null),
    flyer: useRef<HTMLDivElement>(null),
    pmenu: useRef<HTMLDivElement>(null),
    sOn: useRef<HTMLButtonElement>(null),
    sOff: useRef<HTMLButtonElement>(null),
    tDark: useRef<HTMLButtonElement>(null),
    tLight: useRef<HTMLButtonElement>(null),
    itip: useRef<HTMLDivElement>(null),
  };
  // the page island's drag / menu placement / tip driver, created inside useGSAP; menu() and the island's
  // click reach it through this ref (same pattern as updateSealSoundRef below)
  const islandRef = useRef<PageIslandDriver | null>(null);

  const experienceRef = useRef<ExperienceHandle>(null);
  const [soundOnState, setSoundOnState] = useState(false);
  const ktRef = useRef<KeysVelocity>({ chaos: 0.05, orange: 0.9 });
  // set once the ticker effect mounts; lets click handlers reach into loop-local state
  const updateSealSoundRef = useRef<() => void>(() => {});

  // ---------- sound ----------
  async function applySound(on: boolean) {
    await setSoundOn(on);
    setSoundOnState(on);
    masthead.navSoundBtn.current?.setAttribute("aria-pressed", String(on));
    if (masthead.navSoundLabel.current) masthead.navSoundLabel.current.textContent = on ? "Sound on" : "Sound off";
    experienceRef.current?.setSoundAskPressed(on);
    if (!on) setBed(0);
    else updateSealSoundRef.current();
  }

  // ---------- theme ----------
  function pickTheme(t: "dark" | "light") {
    setTheme(t);
  }
  // reads the DOM attribute directly rather than the `resolvedTheme` closure: tick() is created
  // once inside useGSAP (empty deps) and never re-runs, so a closure over React state here would
  // permanently capture whatever theme was active on the very first render.
  const isDark = () => document.documentElement.getAttribute("data-theme") === "dark";

  // ---------- page island menu ----------
  function menu(open: boolean) {
    // place it before it opens, so the spring grows it out of the island's current spot
    if (open) islandRef.current?.placeMenu();
    pageIsland.pmenu.current?.classList.toggle("open", open);
    pageIsland.pisl.current?.setAttribute("aria-expanded", String(open));
    if (pageIsland.pisl.current) pageIsland.pisl.current.style.visibility = open ? "hidden" : "visible";
    play(open ? "expand" : "collapse", 0.5);
  }
  // a click that is really the end of a drag must not open the menu
  function onIslandClick() {
    if (islandRef.current?.clickFromDrag()) return;
    menu(true);
  }

  useGSAP(() => {
    const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const pisl = pageIsland.pisl.current!;
    const pmenu = pageIsland.pmenu.current!;

    function onPointerDown(e: PointerEvent) {
      const target = e.target as HTMLElement;
      if (pmenu.classList.contains("open") && !target.closest("#pmenu") && !target.closest("#pisl")) menu(false);
    }
    function onKeydown(e: KeyboardEvent) {
      if (e.key === "Escape" && pmenu.classList.contains("open")) {
        menu(false);
        pisl.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeydown);
    pmenu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => menu(false)));

    // ---------- ruler ticks ----------
    const ruler = document.getElementById("ruler");
    if (ruler) {
      for (let db = 80; db >= 20; db -= 5) {
        const t = document.createElement("div");
        t.className = "tk";
        t.style.top = ((80 - db) / 60) * 100 + "%";
        t.innerHTML = db % 10 === 0 ? `<span>${db}</span><i style="width:12px"></i>` : '<i style="width:6px"></i>';
        ruler.appendChild(t);
      }
    }

    // ---------- Experience internal nodes ----------
    const exp = experienceRef.current!;
    const {
      hero, gL, gR, gDot, gGap, chapNum, anchor, island, laptopEl, baseEl, lidEl, macEl, screenEl, screenInEl,
      islWrap, dockCard, lWhere, lCur, lTrail, stageCanvas, sealCanvas,
    } = exp.getNodes();

    const heroEl = hero;
    const navEl = document.getElementById("nav")!;
    let navH = 64;
    function setNavH() {
      navH = navEl.offsetHeight;
      document.documentElement.style.setProperty("--navh", navH + "px");
    }
    setNavH();

    // ---------- page island: free drag anywhere, keyboard moves, saved spot, menu placement, one time tip ----------
    const pageIsl = createPageIsland(
      { pisl, pmenu, itip: pageIsland.itip.current!, nav: navEl },
      {
        play,
        onDragStart: () => menu(false),
        viewport: () => ({ w: window.innerWidth, h: window.innerHeight }),
        now: () => performance.now(),
        storage: () => window.localStorage,
      }
    );
    islandRef.current = pageIsl;
    pageIsl.measure();
    pageIsl.init();
    pisl.addEventListener("pointerdown", pageIsl.pointerdown);
    pisl.addEventListener("pointermove", pageIsl.pointermove);
    pisl.addEventListener("pointerup", pageIsl.pointerup);
    pisl.addEventListener("pointercancel", pageIsl.pointercancel);
    pisl.addEventListener("keydown", pageIsl.keydown);

    // sample the tray's spring curves into real CSS linear() easings; the cubic-bezier
    // fallbacks already in globals.css cover browsers without linear() support
    if (CSS.supports("easing", "linear(0,1)")) {
      const { open, close } = traySprings();
      document.documentElement.style.setProperty("--sp-open", open);
      document.documentElement.style.setProperty("--sp-close", close);
    }

    // the laptop screen's inner content is a fixed 1280x800 canvas, scaled down to fit
    function fitScreen() {
      if (screenInEl && screenEl) screenInEl.style.transform = `scale(${screenEl.clientWidth / 1280})`;
    }
    fitScreen();

    // ---------- the island scene (#mac): drag legs, tray stops, mode story, cursor, label, grid, trail ----------
    const scene =
      island && islWrap && dockCard && lWhere && lCur && lTrail
        ? createIslandScene(
            { wrap: islWrap, island, tray: dockCard, where: lWhere, cursor: lCur, trail: lTrail },
            {
              setStep: (n) => exp.setLapStep(n),
              setMode: (k) => exp.setMode(k),
              pickMode: (k) => exp.pickMode(k),
              setTrayDir: (d) => exp.setTrayDir(d),
              play,
            }
          )
        : null;
    // the tray's layout size, read once here (and on resize / fonts ready) so tick() never reads it after a write
    scene?.measure();

    let heroP = 0, chapP = 0, lapP = 0, sealP = 0;
    // gsap/ScrollTrigger are bundled module imports here (unlike the reference's CDN
    // <script> tags), so they're always defined once this effect runs; the only real
    // gate for pinning is the visitor's reduced-motion preference.
    const PIN = !RM;
    const ST: { hero?: ScrollTrigger; chap?: ScrollTrigger; mac?: ScrollTrigger; seal?: ScrollTrigger } = {};

    let sealVisible = false, sealSounded = false;

    function updateSealSound() {
      if (!isSoundOn()) return;
      setBed(sealVisible ? (sealP < 0.86 ? 0.9 * (1 - ss(0.1, 0.86, sealP) * 0.75) : 0) : 0);
      if (sealVisible && sealP >= 0.86 && !sealSounded) {
        sealSounded = true;
        play("anc", 0.9);
      }
      if (sealP < 0.8) sealSounded = false;
    }
    updateSealSoundRef.current = updateSealSound;

    // ---------- smooth scroll ----------
    // one Lenis instance, shared by the ticker-driven scroll smoothing AND goTo() below --
    // splitting these into two unaware instances is what let hash-link clicks (e.g. the
    // logo) bypass the spring follow entirely and leave the stage mid-interpolation.
    let lenis: Lenis | null = null;
    if (PIN) {
      lenis = new Lenis({ lerp: 0.07, wheelMultiplier: 0.85, touchMultiplier: 1.4, smoothWheel: true });
    }
    const PIN_TARGETS: Record<string, keyof typeof ST> = { "#hero": "hero", "#chapters": "chap", "#mac": "mac", "#seal": "seal" };
    function goTo(hash: string) {
      // a pinned section's own getBoundingClientRect() reflects GSAP's pin-spacer, not its
      // resting document position, so for pinned targets scroll to the trigger's own cached
      // start instead of asking the element where it thinks it is.
      const stKey = PIN_TARGETS[hash];
      const pinnedStart = stKey ? ST[stKey]?.start : undefined;
      if (pinnedStart != null) {
        if (lenis) lenis.scrollTo(pinnedStart, { duration: 1.6 });
        else window.scrollTo({ top: pinnedStart });
        return;
      }
      const el = document.querySelector(hash);
      if (!el) return;
      if (lenis) lenis.scrollTo(el as HTMLElement, { offset: -navEl.offsetHeight + 1, duration: 1.6 });
      else el.scrollIntoView();
    }
    const lenisTick = (t: number) => lenis?.raf(t * 1000);
    if (PIN) {
      gsap.registerPlugin(ScrollTrigger);
      if (lenis) {
        lenis.on("scroll", ScrollTrigger.update);
        gsap.ticker.add(lenisTick);
        gsap.ticker.lagSmoothing(0);
      }
      const start = () => "top " + navH;
      ScrollTrigger.defaults({ anticipatePin: 1 });
      ST.hero = ScrollTrigger.create({ trigger: "#hero", start, end: "+=150%", pin: true, onUpdate: (s) => (heroP = s.progress) });
      ST.chap = ScrollTrigger.create({ trigger: "#chapters", start, end: "+=240%", pin: true, onUpdate: (s) => (chapP = s.progress) });
      ST.mac = ScrollTrigger.create({ trigger: "#mac", start, end: "+=720%", pin: true, onUpdate: (s) => (lapP = s.progress) });
      ST.seal = ScrollTrigger.create({
        trigger: "#seal",
        start,
        end: "+=150%",
        pin: true,
        onUpdate: (s) => {
          sealP = s.progress;
          updateSealSound();
        },
      });

      gsap.utils.toArray<HTMLElement>(".fig, .mcard").forEach((el) =>
        gsap.from(el, { y: 40, opacity: 0.25, duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 92%" } })
      );
      ScrollTrigger.create({
        trigger: "#download",
        start: "top 75%",
        onEnter: () => {
          gsap.fromTo(".lock", { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 1, ease: "back.out(2)" });
          play("logo", 0.8);
        },
      });
      ScrollTrigger.addEventListener("refreshInit", setNavH);
    } else {
      // no pins: the scene holds still with the tray open at the left edge
      sealP = 1;
      lapP = STATIC_P;
      chapP = 0;
    }

    const anchors = [...document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
    const onAnchorClick = (a: HTMLAnchorElement) => (e: MouseEvent) => {
      const h = a.getAttribute("href");
      if (h && h.length > 1) {
        e.preventDefault();
        goTo(h);
      }
    };
    const anchorHandlers = anchors.map((a) => {
      const handler = onAnchorClick(a);
      a.addEventListener("click", handler);
      return { a, handler };
    });

    // ---------- stage ----------
    const frameStage = stageCanvas ? new Stage3D(stageCanvas, window.innerWidth, () => {}) : null;

    // ---------- the journey ----------
    function doJourney(y: number) {
      const K = keyframes({
        hero: { start: ST.hero!.start, end: ST.hero!.end },
        chap: { start: ST.chap!.start, end: ST.chap!.end },
        mac: { start: ST.mac!.start, end: ST.mac!.end },
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        navH,
        gGap: gGap!,
        heroEl: heroEl!,
        anchor: anchor!,
        laptopEl: laptopEl!,
        baseEl: baseEl!,
      });
      return journey(y, K);
    }

    // ---------- loop state ----------
    const t0 = performance.now();
    let tPrev = performance.now();
    let cur: { x: number; y: number; h: number; f: number; o: number } | null = null;
    let popped = false;
    let lastPc = -1;
    let gx = 0;
    let lidOpen = 0;

    function inView(el: Element) {
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight;
    }

    const kv: KeysVelocity = { chaos: 0.05, orange: 0.9 };
    const keysCanvas = modes.keysCanvas.current;
    function sizeCan(c: HTMLCanvasElement) {
      const d = Math.min(window.devicePixelRatio || 1, 2);
      c.width = c.clientWidth * d;
      c.height = c.clientHeight * d;
      const x = c.getContext("2d")!;
      x.setTransform(d, 0, 0, d, 0, 0);
      return x;
    }
    let kg = keysCanvas ? sizeCan(keysCanvas) : null;
    let sg = sealCanvas ? sizeCan(sealCanvas) : null;

    function tick() {
      const now = performance.now();
      const t = (now - t0) / 1000;
      const dt = Math.min(0.05, Math.max(0.001, (now - tPrev) / 1000));
      tPrev = now;

      // ---- read phase ----
      const y = window.scrollY;
      const H = window.innerHeight;
      const docH = document.documentElement.scrollHeight - H;
      const frac = docH > 0 ? clamp(y / docH, 0, 1) : 0;
      const sealVis = sealCanvas ? inView(sealCanvas) : false;
      const keysVis = keysCanvas ? inView(keysCanvas) : false;
      scene?.read();

      let j: ReturnType<typeof doJourney> | null = null;
      let macTop = 0, gapW = 0, flight = 0;
      let A: ReturnType<typeof rc> | null = null;
      // the fly-out lands on the island's stored spot and natural size, never its bounding box: while hidden
      // it is scaled to 0.4. Not a layout read (the size was measured up front).
      let P: ReturnType<PageIslandDriver["flightTarget"]> | null = null;

      if (PIN) {
        gapW = gGap!.offsetWidth;
        macTop = macEl!.getBoundingClientRect().top;
        j = doJourney(y);
        flight = ss(0.86, 0.97, lapP);
        if (flight > 0 && flight < 1) {
          A = rc(anchor!);
          P = pageIsl.flightTarget();
        }
      }

      // ---- write phase ----
      if (pageIsland.pbar.current) pageIsland.pbar.current.style.transform = `scaleX(${frac})`;

      const db = lerp(78, 22, frac);
      exp.setRulerValue(Math.round(db));
      const rInd = document.getElementById("rInd");
      if (rInd) rInd.style.transform = `translateY(${((80 - db) / 60) * (H - navH - 80)}px) translateY(-50%)`;

      if (PIN && j) {
        const k = 1 - Math.exp(-dt * 11);
        const close = ss(0.22, 0.8, heroP);
        gx += (close * gapW / 2 - gx) * k;
        if (gL) gL.style.transform = `translate3d(${gx}px,0,0)`;
        if (gR) gR.style.transform = `translate3d(${-gx}px,0,0)`;
        if (heroP > 0.8 && !popped) {
          popped = true;
          if (gDot) gsap.fromTo(gDot, { scale: 0.15 }, { scale: 1, duration: 1, ease: "back.out(3.2)" });
          play("anc", 0.7);
        }
        if (heroP < 0.72) popped = false;

        const pc = chapP < 0.33 ? 0 : chapP < 0.66 ? 1 : 2;
        if (pc !== lastPc) {
          lastPc = pc;
          exp.setChapStep(pc);
        }
        if (chapNum) chapNum.style.transform = `translateY(-50%) translate3d(${(chapP - 0.5) * -8}%,0,0)`;

        const openT = ss(H * 0.75, navH + 2, macTop);
        lidOpen += (openT - lidOpen) * k;
        if (lidEl) lidEl.style.transform = `rotateX(${(1 - lidOpen) * -88}deg)`;
        if (laptopEl) laptopEl.style.transform = `scale(${0.92 + lidOpen * 0.08}) translate3d(0,${(1 - lidOpen) * 24}px,0)`;

        scene?.write(lapP, flight, now, dt);

        const flyer = pageIsland.flyer.current;
        if (A && P && flyer) {
          const e = ease(flight);
          const d0 = A.w, d1 = P.size;
          const x = lerp(A.x - d0 / 2, P.x, e);
          const yy = lerp(A.y - d0 / 2, P.y, e) + Math.sin(Math.PI * e) * -70;
          const s = lerp(d0, d1, e) / 62;
          flyer.style.display = "flex";
          flyer.style.transform = `translate3d(${x}px,${yy}px,0) scale(${s})`;
        } else if (flyer) {
          flyer.style.display = "none";
        }
        const earned = flight >= 1 || y > ST.mac!.end;
        pisl.classList.toggle("hide", !earned);
        pageIsl.setShown(earned);

        if (!cur) cur = { ...j };
        const kp = 1 - Math.exp(-dt * 10);
        const kf = 1 - Math.exp(-dt * 8);
        cur.x += (j.x - cur.x) * kp;
        cur.y += (j.y - cur.y) * kp;
        cur.h += (j.h - cur.h) * kp;
        cur.f += (j.f - cur.f) * kf;
        cur.o += (j.o - cur.o) * kp;
        const bob = Math.sin(t * 1.1) * 4 * (1 - ss(ST.mac!.start - 300, ST.mac!.start, y));
        frameStage?.draw({ x: cur.x, y: cur.y + bob, h: cur.h, f: cur.f, o: cur.o });
      } else if (!PIN) {
        pisl.classList.remove("hide");
        pageIsl.setShown(true);
        scene?.write(lapP, 0, now, dt);
        const hr = heroEl!.getBoundingClientRect();
        const g = rc(gGap!);
        frameStage?.draw({ x: g.x, y: g.y, h: Math.min(hr.height * 0.5, window.innerWidth * 0.36), f: 0, o: hr.bottom > 0 ? 1 : 0 });
      }

      if (sealVis !== sealVisible) {
        sealVisible = sealVis;
        updateSealSound();
      }
      if (sealVis && sg && sealCanvas) {
        const { db: sealDb, label: sealLabel } = drawSeal(sg, sealCanvas, RM ? 0 : t, sealP, isDark);
        exp.setSealReadout(sealDb, sealLabel);
      }
      if (keysVis && kg && keysCanvas) {
        drawKeys(kg, keysCanvas, RM ? 0 : t, kv, ktRef.current, isDark);
      }
    }

    let raf = 0;
    if (PIN) {
      gsap.ticker.add(tick);
    } else {
      const loop = () => {
        tick();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    function onResize() {
      frameStage?.sizeStage();
      if (keysCanvas) kg = sizeCan(keysCanvas);
      if (sealCanvas) sg = sizeCan(sealCanvas);
      fitScreen();
      setNavH();
      scene?.measure();
      pageIsl.resize();
    }
    window.addEventListener("resize", onResize);

    document.fonts?.ready.then(() => {
      scene?.measure();
      pageIsl.resize();
      if (PIN) ScrollTrigger.refresh();
    });

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeydown);
      window.removeEventListener("resize", onResize);
      pisl.removeEventListener("pointerdown", pageIsl.pointerdown);
      pisl.removeEventListener("pointermove", pageIsl.pointermove);
      pisl.removeEventListener("pointerup", pageIsl.pointerup);
      pisl.removeEventListener("pointercancel", pageIsl.pointercancel);
      pisl.removeEventListener("keydown", pageIsl.keydown);
      pageIsl.destroy();
      islandRef.current = null;
      anchorHandlers.forEach(({ a, handler }) => a.removeEventListener("click", handler));
      if (PIN) {
        gsap.ticker.remove(tick);
        gsap.ticker.remove(lenisTick);
      } else cancelAnimationFrame(raf);
      lenis?.destroy();
      Object.values(ST).forEach((st) => st?.kill());
      frameStage?.dispose();
    };
  }, []);

  return (
    <>
      <Nav refs={masthead} onSoundClick={() => applySound(!soundOnState)} />
      <PageIsland
        refs={pageIsland}
        onToggleMenu={onIslandClick}
        onSetSound={applySound}
        onSetTheme={pickTheme}
        soundOn={soundOnState}
        isDark={resolvedTheme === "dark"}
      />
      <main>
        <Experience ref={experienceRef} onSoundAskClick={() => applySound(!soundOnState)} />
        <Modes
          refs={modes}
          onPickKey={(k) => {
            ktRef.current = KT[k] ?? ktRef.current;
            play(k === "off" ? "off" : k, 0.8);
          }}
          onKeySoundOn={() => applySound(true)}
          soundOn={soundOnState}
        />
        <HandsFree />
        <Download />
      </main>
      <Footer />
    </>
  );
}
