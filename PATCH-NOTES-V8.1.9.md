# LaunchBoard V8.1.9 Patch

## Fixes
- Restores the compact desktop product layout from V8.1.7.
- Keeps the working message attachment feature from V8.1.8.
- Repairs review loading so it no longer depends on a Supabase embedded profile relationship.
- Repairs review posting with a required unique product/user index and RLS policies.

## Upload only
- `product.html`
- `product.js`
- `styles.css`

## Database
Run `supabase-v8.1.9-review-fix.sql` once in Supabase SQL Editor.

No message files need to be uploaded because attachments are already working.
