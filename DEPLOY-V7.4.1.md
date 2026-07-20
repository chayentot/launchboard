# LaunchBoard 7.4.1-full — Full Refresh Package

This is a complete replacement package.

## Why the old menu remained

The screenshot still showed the four-item navigation, which means the Android WebView or hosted site was loading an older cached `common.js`, `styles.css`, or HTML file.

This package forces a refresh by:
- adding `?v=7.4.1-full` to every local CSS and JavaScript reference
- adding no-cache metadata to every HTML page
- rebuilding the five-item navigation at runtime
- putting the same five-item navigation in every HTML file
- adding a build marker to every page

## Required upload method

1. Delete the old website files from the GitHub Pages folder.
2. Upload **every file** from this package to that same folder.
3. Do not upload the folder itself inside another folder.
4. Confirm this direct URL opens:
   `notifications.html`
5. Open page source and search for:
   `7.4.1-full`
6. Clear Android app storage, not only cache.
7. Reopen the app.

## Expected bottom navigation

Home | Message | Sell | Notification | Profile

## Supabase

Run:
`supabase-v7.4.1-notifications.sql`

in Supabase SQL Editor so the Notifications page has its table and policies.
