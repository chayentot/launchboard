# LaunchBoard V8.2.1 — Dashboard Header Restore Patch

## Upload only
- `dashboard.html`

## Restored desktop dashboard navigation
- Message
- Notification
- Profile button with avatar and creator name
- Profile dropdown containing dashboard, creator profile, saved products, following, and logout

## Preserved
- V8.2 messaging and attachments
- Product-aware chat
- Compact product page
- Mobile dashboard layout
- Existing Supabase configuration

## Database
No SQL migration is required.

## Deployment
Overwrite the existing `dashboard.html` in the repository, commit, and wait for GitHub Pages deployment to finish. Hard-refresh the browser afterward if the old header is cached.
