# LaunchBoard V9.3.1 Onboarding Hotfix

This hotfix forces every newly registered, immediately authenticated user onto the Follow 5 Creators page.

## Replace
- common.js
- onboarding.js
- onboarding.html

## Required index.html cache bump
Change the common.js script tag on every page to:

```html
<script defer src="common.js?v=9.3.1"></script>
```

## Service worker
Increase the cache name/version and remove old cached common.js/onboarding.js entries. Deploy, purge Cloudflare cache, then clear site data or uninstall/reinstall the PWA.

## Supabase
Email confirmation must be OFF, and launchboard-v9.3.sql must already be applied.

## Test
Use a brand-new email address. Successful signup must go to `onboarding.html?new=1`. The pending onboarding marker is cleared only after following at least five creators and pressing Continue.
