# LaunchBoard v6.2 — Publish Stability

Fixes the Android `Failed to fetch` product-publishing problem.

## Improvements

- Uses a safe filename when `crypto.randomUUID()` is unavailable.
- Adds a 20-second upload timeout.
- If Supabase Storage cannot be reached, the selected image is resized and compressed in the app, then attached directly to the product as a fallback.
- Uses FileReader for reliable Android image previews.
- Prevents duplicate submissions while publishing.
- Shows clearer upload and network errors.
- Allows publishing without an image when the network remains unavailable.

## Replace

- dashboard.js
- styles.css

Clear the Android app/WebView cache after uploading.
