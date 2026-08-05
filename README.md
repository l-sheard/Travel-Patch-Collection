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

Requires a `.env` file (gitignored) — copy `.env.example` to `.env` and fill
in your Supabase project values:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

`VITE_TURNSTILE_SITE_KEY` and `VITE_SENTRY_DSN` are optional (see below) —
leave them blank locally.

Other useful commands:

```bash
npm run lint    # oxlint
npm run test    # vitest
npm run build   # typecheck + production build
```

CI (`.github/workflows/ci.yml`) runs lint, test, and build on every push/PR
to `main`.

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

## Going live for real signups

The app is safe for strangers to sign up for out of the box (Postgres RLS
scopes every table and storage bucket to `auth.uid()`, and the anon key is
meant to be public). A few things only exist as dashboard/account
configuration, not code, so do these once before sharing the link widely:

1. **Custom SMTP for auth emails.** Supabase's built-in mailer is rate-limited
   (a few emails/hour) and lands in spam — fine for development, not for a
   real signup flow. In **Supabase → Authentication → Emails → SMTP Settings**,
   plug in a free-tier provider (e.g. [Resend](https://resend.com) or
   [Postmark](https://postmarkapp.com)). Without this, confirmation and
   password-reset emails to real users may never arrive.
2. **Site URL / Redirect URLs.** In **Supabase → Authentication → URL
   Configuration**, set Site URL to your deployed URL (e.g. your Netlify
   domain) and add it to Redirect URLs — required for the password-reset
   link to land back on your app instead of `localhost`.
3. **CAPTCHA on auth forms.** Create a free
   [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile)
   widget (widget mode: "Managed"), then:
   - set `VITE_TURNSTILE_SITE_KEY` (Netlify env var + local `.env`) to the
     site key — the app will automatically show the widget on sign-in,
     sign-up, and password reset once it's set;
   - in **Supabase → Authentication → Attack Protection**, enable CAPTCHA
     protection and paste in the Turnstile *secret* key.
   Without this, public signup is open to bot abuse.
4. **Re-run `supabase/schema.sql`** if you set this project up before file
   size limits were added — it now caps uploads at 15MB/image per bucket
   (idempotent, safe to re-run).
5. **Error monitoring (optional).** Create a free
   [Sentry](https://sentry.io) project, set `VITE_SENTRY_DSN` (Netlify env
   var), and uncaught errors from real visitors get reported instead of
   silently failing.

## License

MIT — see [LICENSE](LICENSE).
