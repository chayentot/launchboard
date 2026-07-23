# LaunchBoard V9.3 — Smart Creator Onboarding

## Install

1. In Supabase, open **Authentication → Providers → Email** and turn **Confirm email** off.
2. Run `launchboard-v9.3.sql` in the Supabase SQL Editor.
3. Upload these files to the site root:
   - `common.js`
   - `app.js`
   - `onboarding.html`
   - `onboarding.js`
4. In every HTML page, cache-bust the shared scripts:

```html
<script defer src="common.js?v=9.3.0"></script>
<script defer src="app.js?v=9.3.0"></script>
```

5. Add `onboarding.html` and `onboarding.js` to the service-worker precache list, and change the cache name, for example to `launchboard-v9.3.0`.
6. Deploy, clear Cloudflare cache, then clear the installed PWA/site data before testing.

## Flow

New registration → immediate session → profile marked incomplete → onboarding → follow 5 creators → database trigger marks complete → marketplace.

Existing accounts are grandfathered by the migration and will not be forced through onboarding.
