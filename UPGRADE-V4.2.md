# LaunchBoard V4.2 Discovery Upgrade

This upgrade focuses on polish, discovery, and usability while preserving the V4.1 database.

## New

- Professional homepage hero
- Live marketplace statistics
- Featured/premium showcase
- Advanced search across title, description, brand, creator, category, country, type, and tags
- Category and product-type filters
- Sorting by newest, views, clicks, likes, and premium
- Category chips
- Load-more pagination
- Top creator discovery
- Better empty states
- Improved mobile layout
- Safer no-image placeholders

## Install

Replace:

- `index.html`
- `app.js`
- `styles.css`
- `creator.html`

Keep every other V4.1 file, especially your working `config.js`.

Optional: run `supabase-v4.2-discovery-indexes.sql` in a new Supabase SQL query.

After GitHub Pages deploys, open:

`https://chayentot.github.io/launchboard/?v=4.2`
