# Travel Patches

**[travelpatchcollection.netlify.app →](https://travelpatchcollection.netlify.app/)**

An installable web app for cataloguing a physical travel patch collection.
Scan a patch with your phone's camera and it's matched against ones already
logged using an on-device computer vision model. Add a new one with its trip
dates, location, companions, and photos, and it's automatically plotted on a
world map and turned into a background-removed "sticker" for the gallery
view.

Full auth with password reset and CAPTCHA-protected signup, Postgres
row-level security scoping every user to their own data, upload validation,
and CI running lint/test/build on every push. Anyone can create an account
and use it.

## Features

- **Scan-to-match** — point the camera at a patch and it's matched against
  your existing collection via on-device MobileNet embeddings + perceptual
  hashing, so duplicates get caught before you re-log the same patch.
- **Rich per-patch logging** — location (geocoded and pinned on a map),
  trip/purchase dates, travel companions, holiday type tags, star rating
  and review, cost, accommodations (with ratings/notes/nights/people),
  restaurants, and memorable dishes with their own photos.
- **Trips** — group patches from the same trip together with a shared
  itinerary, highlights, and review.
- **Gallery** — every patch rendered as a background-removed sticker
  (processed on-device), filterable and sortable.
- **Map view** — the whole collection plotted geographically.
- **Installable PWA** — add it to your home screen on iOS/Android for a
  native-app-like experience with camera access, offline-cached assets.

## Tech stack

**Frontend**
React 19 + TypeScript + Vite · Tailwind CSS v4 · React Router · TanStack
Query

**Backend**
Supabase — Postgres (with row-level security on every table), Auth, and
Storage (private buckets, size/type-limited uploads)

**On-device machine learning / image processing**
- `@tensorflow-models/mobilenet` — scan-match embeddings
- `@imgly/background-removal` — gallery "sticker" processing
- Leaflet + OpenStreetMap/Nominatim — mapping and geocoding

**Auth & security**
Supabase Auth (email/password, password reset) · Cloudflare Turnstile
CAPTCHA on auth forms · Sentry error monitoring

**Testing & CI**
Vitest + Testing Library · GitHub Actions (lint, test, build on every
push/PR)

**PWA**
`vite-plugin-pwa` (installable, offline asset caching)

## License

MIT — see [LICENSE](LICENSE).
