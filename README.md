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
