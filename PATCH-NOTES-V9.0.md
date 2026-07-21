# LaunchBoard V9.0 — Website Install App Patch

## What users see
- A visible **Get the LaunchBoard app** banner on the website.
- Android/Chrome/Edge users receive the browser installation prompt.
- iPhone/iPad users receive Safari **Add to Home Screen** instructions.
- The banner disappears when LaunchBoard is already installed.

## Files to upload
- common.js
- styles.css
- manifest.webmanifest
- service-worker.js
- icons/icon-192.png
- icons/icon-512.png

## Hosting
The website must be served over HTTPS. GitHub Pages, Netlify, Cloudflare Pages, and Vercel are suitable for this static site.

## GitHub Pages
Place all website files at the published site root. Keep the `icons` folder. Enable Pages under repository Settings → Pages. A custom domain can be added later.

## Important
A PWA is installed directly from the live website. Users do not download the ZIP or an APK from GitHub.
