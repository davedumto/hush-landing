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

## Feedback API

The app also exposes a feedback pipeline used by the hush. macOS app itself:
`POST /api/feedback` validates and stores bug reports / feature requests in
Postgres, forwards them to a Discord channel, and an `/admin` page lets you
triage them.

### 1. Create the database

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the **pooled** connection string (Neon dashboard → Connection Details →
   "Pooled connection") into `DATABASE_URL`.
3. Run the migration:

   ```bash
   npm run db:migrate
   ```

   This applies `drizzle/0000_serious_grim_reaper.sql`, creating the `feedback`
   and `rate_events` tables.

### 2. Create the Discord webhook

In your Discord server: **Server Settings → Integrations → Webhooks → New
Webhook**, pick the channel you want reports posted to, copy the webhook URL
into `DISCORD_WEBHOOK_URL`.

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill in real values:

```bash
cp .env.example .env.local
```

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon pooled Postgres connection string |
| `DISCORD_WEBHOOK_URL` | Discord webhook that receives new feedback |
| `ADMIN_PASSWORD` | Password for the `/admin` login form |
| `ADMIN_TOKEN` | Bearer token for scripted access to `/api/admin/list` |
| `COOKIE_SECRET` | Random string used to sign the admin session cookie |
| `IP_HASH_SALT` | Random string used to salt hashed IPs/client UUIDs |

Generate random secrets with, e.g.:

```bash
openssl rand -hex 32
```

### 4. Set the same env vars in Vercel

```bash
vercel env add DATABASE_URL
vercel env add DISCORD_WEBHOOK_URL
vercel env add ADMIN_PASSWORD
vercel env add ADMIN_TOKEN
vercel env add COOKIE_SECRET
vercel env add IP_HASH_SALT
```

Then deploy:

```bash
vercel --prod
```

### 5. Test the endpoint

```bash
curl -X POST https://<your-app>.vercel.app/api/feedback \
  -H "content-type: application/json" \
  -d '{
    "type": "bug",
    "title": "Menu bar icon disappears",
    "description": {
      "whatHappened": "The icon vanished after waking from sleep",
      "steps": "Sleep the Mac, then wake it",
      "expected": "Icon should still be in the menu bar"
    },
    "appVersion": "1.2.0",
    "appBuild": "42",
    "macosVersion": "15.1",
    "macModel": "MacBook Pro 16-inch 2023",
    "clientUuid": "00000000-0000-0000-0000-000000000000"
  }'
```

### 6. Point the macOS app at it

Set the app's `FeedbackEndpointURL` build setting to:

```
https://<your-app>.vercel.app/api/feedback
```

### Admin page

Visit `/admin`, log in with `ADMIN_PASSWORD`. Reports can be filtered by type
and status, searched by title, and marked "seen"/"done". `GET
/api/admin/list` returns the same data as JSON for scripting, authenticated
either by the admin session cookie or an `Authorization: Bearer
<ADMIN_TOKEN>` header.

### Running the tests

```bash
npm run test
```

## 3D model attribution

The headphone model rendered on the stage is **JBL Tune 720BT** by
[polyman](https://sketchfab.com/Polyman_3D) on Sketchfab, licensed under
[CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).

## Deployment

Deployed on [Vercel](https://vercel.com).
