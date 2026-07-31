# Travel Patches

A PWA for cataloguing a physical travel patch collection: scan a patch to
match it against ones already logged, or add a new one with its trip dates,
purchase date, location, travel companions, description, and photos. Patches
plot on a world map by location, and the gallery view shows each one as a
background-removed "sticker."

## Stack

- React + TypeScript + Vite, Tailwind CSS v4, React Router, TanStack Query
- PWA via `vite-plugin-pwa` (installable, works on desktop + phone browsers)
- Supabase (Postgres + Auth + Storage) for cloud-synced data
- Client-side, on-device only: `@tensorflow-models/mobilenet` for scan-match
  embeddings, `@imgly/background-removal` for gallery image processing,
  Leaflet/OpenStreetMap + Nominatim for the map (no paid API keys anywhere)

See `.claude/plans/` (or ask Claude) for the full architecture plan and
phased build order.

## Local development

```bash
npm install
npm run dev
```

Requires a `.env` file (gitignored) once Supabase is wired up in Phase 2:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Deploying (Netlify)

`netlify.toml` is already configured (build command, publish dir, and the
SPA redirect rule client-side routing needs). To deploy:

1. Sign up at [netlify.com](https://netlify.com) and click **Add new site →
   Import an existing project**.
2. Connect your GitHub account and pick this repo
   (`l-sheard/Travel-Patch-Collection`).
3. Build settings should auto-detect from `netlify.toml` — leave them as-is.
4. Before the first deploy, add your Supabase credentials under **Site
   configuration → Environment variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   (same values as your local `.env` — these are safe to set here since
   they're the public anon key, protected by Row Level Security, not a
   secret key.)
5. Deploy. Netlify will auto-redeploy on every push to `main`.
6. On your phone, open the deployed URL in the browser and use "Add to Home
   Screen" (Safari: Share → Add to Home Screen; Chrome/Android: menu →
   Install app) to get the installed-PWA experience with camera access.
