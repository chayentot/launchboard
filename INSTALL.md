# Install LaunchBoard V4

1. Back up your current GitHub repository.
2. In Supabase SQL Editor, run `supabase-v4-migration.sql` in a new query. If a policy-already-exists error appears from an older V3 policy, send the exact policy name; do not delete tables.
3. Upload every `.html`, `.js`, and `styles.css` file from this package to the repository root.
4. Keep your existing `config.js` with your Supabase URL and publishable key.
5. Commit and wait for GitHub Pages. Open `https://chayentot.github.io/launchboard/?v=4`.
6. Admin remains at `/launchboard/admin.html` and is not linked publicly.

Important: V4 never reloads the page for Supabase `INITIAL_SESSION`, so the authentication refresh loop is removed.
