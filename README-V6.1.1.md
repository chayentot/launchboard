# LaunchBoard v6.1.1 — Home Products Hotfix

This hotfix fixes the v6.1 homepage issue where the page appeared stuck and products disappeared.

## Cause

The v6.1 cleanup accidentally removed:
- productGrid
- categoryChips
- emptyProducts
- loadMore

Because app.js expected those elements, product rendering stopped.

## Fixed

- Restored the Discover product grid.
- Restored empty-state and Load More controls.
- Restored the hidden category-chip container used by the filter logic.
- Added safer JavaScript checks so an optional missing element cannot stop homepage loading.

## Install

Replace:
- index.html
- app.js

You may upload the full package as well.

Then clear the Android app/WebView cache and reopen the app.
