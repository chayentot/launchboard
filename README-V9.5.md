# LaunchBoard V9.5 — Saved Products + Following

## Included

- `saved.html`
- `saved.js`
- `following.html`
- `following.js`
- `library-pages.css`
- updated `dashboard.html`
- existing `mobile-profile-menu.js`
- existing `dashboard-responsive.css`
- optional `launchboard-v9.5-policies.sql`

## Database mapping

This version is based on the tables already used by your LaunchBoard code:

- Saved products: `product_likes`
  - `user_id`
  - `product_id`
  - `created_at`
- Following: `creator_follows`
  - `follower_id`
  - `creator_id`
  - `created_at`

The pages also read `products` and `profiles`.

## Installation

1. Upload all files in this package to the same folder as `index.html`.
2. Replace your current `dashboard.html`.
3. Keep your existing `config.js`, `common.js`, `styles.css`, and other application files.
4. Run `launchboard-v9.5-policies.sql` only when Supabase reports an RLS permission error.
5. Update the service-worker asset list to include:
   - `/saved.html`
   - `/saved.js`
   - `/following.html`
   - `/following.js`
   - `/library-pages.css`
6. Increase the service-worker cache name/version.
7. Purge deployment cache and clear the installed PWA/site cache.

## Important

Your existing heart/like behavior stores rows in `product_likes`. Therefore this release treats liked products as Saved Products. Removing a saved product deletes the corresponding `product_likes` row.
