LaunchBoard v5.2 Mobile Navigation Fix

Replace:
- common.js
- styles.css

What changed:
- Reliable visible back button on every inner mobile page.
- Android hardware/keypad Back is intercepted so the WebView does not close immediately.
- Messages, creator profile, product details, and edit-product return to dashboard.html.
- Dashboard/Sell returns to index.html.
- Uses location.replace/location.href instead of history.back to avoid empty-history problems.

After upload:
1. Wait for GitHub Pages deployment.
2. Clear the app/browser cache or use a cache-busting query.
3. Reopen the Android app.
