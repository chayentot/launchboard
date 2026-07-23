# LaunchBoard V10 — Production Release

V10 freezes feature development and consolidates the latest LaunchBoard work into one deployable program.

## Included functionality

- Marketplace discovery and product pages
- Creator profiles and creator dashboard
- Product publishing and profile editing
- Messaging, product references and notifications
- Creator onboarding requiring five follows
- Saved Products and Following pages
- Mobile profile bottom-sheet menu
- Responsive mobile and desktop layouts
- PWA manifest, offline page and service worker
- Cloudflare Pages security/cache headers
- Consolidated Supabase migration file
- Local QA smoke-test script

## Before deployment

1. Copy `config.example.js` to `config.js`.
2. Enter your Supabase URL and public anon key.
3. Disable email confirmation only when immediate signup sessions are desired.
4. Run database migrations in a staging project first.
5. Review `supabase-v10-consolidated.sql`; do not blindly run it against a database that already contains all historical migrations.
6. Run:
   `python3 qa-smoke-test.py`
7. Test signup, onboarding, publishing, save/unsave, follow/unfollow, messaging, notifications, profile editing, logout and password reset.
8. Deploy the whole folder.
9. Purge Cloudflare cache and clear old PWA/site data.

## Service-worker rule

The V10 service worker uses network-first navigation and does not cache Supabase traffic. Increase `CACHE_NAME` in `service-worker.js` for every production release.

## Security

`_headers` contains a conservative Content Security Policy and browser security headers. If you add another trusted CDN, analytics service or image host, update the CSP before deployment.

## Honest release status

This package has been assembled and statically checked from the project files available in this conversation. It still needs staging deployment and real Supabase end-to-end testing before being called production-verified.
