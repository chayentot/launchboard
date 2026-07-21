# LaunchBoard V8.1.7 — Compact Desktop Product Patch

## Upload only
- `product.html`
- `styles.css`

Overwrite the matching files in your GitHub repository.

## Changes
- Reduced the desktop product-page maximum width.
- Reduced the desktop product image height and gallery padding.
- Reduced desktop title, price, creator card, signals, and action sizes.
- Made About and Reviews cards more compact.
- Reduced Related Products heading and card sizes.
- Uses desktop-only media queries (`min-width: 901px`).
- Mobile/cellphone product layout is unchanged.

## Database
No Supabase or database changes.

## Cache
`product.html` now requests assets with version `8.1.7` to help GitHub Pages and browsers load the new styles.
