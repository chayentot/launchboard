# LaunchBoard product-promotion website

A responsive static prototype where users can:

- Create an account and log in
- Submit products with an external purchase link
- Browse, search, filter, and sort listings
- Track outbound product-link clicks
- View simple creator profile statistics

## Run locally

Open `index.html` directly in a browser, or use a local server:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Storage and production notes

This prototype stores accounts and listings in browser `localStorage`. It is ideal for demonstrating the product and user flow, but not for production.

For a production launch, replace localStorage with:

- Supabase, Firebase, or a custom PostgreSQL backend
- Secure server-side authentication
- Cloud image storage
- Content moderation and reporting
- Email verification and password reset
- Rate limiting and spam prevention

The external product links can point to Gumroad, Shopify, Etsy, Amazon, a creator's own store, or any other HTTPS sales page.
