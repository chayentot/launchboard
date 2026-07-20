# LaunchBoard v6.1.2 — Navigation and Discover Layout Fix

## Fixed

- Discover Products is now left-aligned.
- Product count stays on the right of the same row.
- Removed the browser-history guard that caused Sell, Messages, and Profile to return automatically to Home.
- Bottom navigation links now open their correct pages normally.
- Android hardware Back is handled only through Capacitor when available:
  - Inner pages -> Home
  - Home -> exit/minimize app

## Install

Replace:
- index.html
- common.js
- styles.css

Then clear the Android app/WebView cache before testing.
