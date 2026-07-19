# LaunchBoard V4.4 Product Layout

## Changes

- Product titles now appear above product images.
- The product detail title, category, and price appear above the main image.
- Numeric prices are displayed as Philippine pesos, for example `₱1,250`.
- Existing prices already beginning with `₱` remain unchanged.
- Non-numeric labels such as `Free` or `Contact seller` remain unchanged.
- Product action buttons are improved on mobile.

## Install

Upload these files to your GitHub LaunchBoard repository:

- `common.js`
- `app.js`
- `product.js`
- `styles.css`

No SQL migration is required.

Because the Android app loads the live LaunchBoard website, deploy the GitHub update first. Reopen the app after GitHub Pages finishes deploying. Rebuilding the APK is only needed if your Android package embeds local web files rather than the live website.
