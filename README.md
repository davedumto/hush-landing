# hush.

A scroll-driven landing page for **hush.**, a macOS menu-bar app that puts JBL headphone noise-control
modes one click from the edge of your screen.

Built with Next.js (App Router), GSAP + ScrollTrigger, Lenis, and a live Three.js render of the
headphones replacing a pre-rendered frame sequence.

## Stack

- **Next.js 16** (App Router, TypeScript)
- **GSAP** + **ScrollTrigger** for the pinned scroll scenes
- **Lenis** for smooth scrolling, driven from `gsap.ticker`
- **Three.js** for the live-rendered 3D headphones on the stage canvas
- **next-themes** for light/dark mode
- Plain CSS, no utility framework

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build   # production build
npm run lint    # eslint
```

## Project structure

- `app/` — root layout, global styles, the single page route
- `components/` — `PageShell` owns the scroll loop, pins, and smooth-scroll setup; `Experience`
  owns the four pinned scenes (hero, chapters, Mac, seal) and the stage canvas; everything else is
  a normally-scrolling section
- `lib/` — the pure scroll/keyframe math (`journey.ts`), the live 3D stage renderer
  (`stage3d.ts`), audio, and the canvas line-drawing used by the seal and modes sections
- `public/` — brand assets, icons, product photos, sound, and the 3D model

## 3D model attribution

The headphone model rendered on the stage is **JBL Tune 720BT** by
[polyman](https://sketchfab.com/Polyman_3D) on Sketchfab, licensed under
[CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).

## Deployment

Deployed on [Vercel](https://vercel.com).
