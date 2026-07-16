# LaunchBoard + Supabase

A GitHub Pages-ready product discovery website with shared public listings, secure Supabase authentication, product image uploads, creator ownership, and outbound click tracking.

## 1. Create a Supabase project

Create a project at Supabase, then open **SQL Editor**, create a new query, paste everything from `supabase-setup.sql`, and run it.

## 2. Add your project credentials

Open **Project Settings → API** in Supabase. Copy your Project URL and publishable key (or legacy anon key), then edit `config.js`:

```js
window.LAUNCHBOARD_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseKey: "YOUR_PUBLISHABLE_KEY"
};
```

Never place the service-role secret in this file. The browser key is protected by the Row Level Security policies installed by `supabase-setup.sql`.

## 3. Configure authentication URLs

In **Authentication → URL Configuration**:

- Set **Site URL** to your GitHub Pages URL, for example `https://USERNAME.github.io/launchboard/`
- Add the same URL under **Redirect URLs**

Email confirmation is enabled by default on many projects. New users may need to click the confirmation link before logging in. For early testing, you can change this in **Authentication → Providers → Email**.

## 4. Publish on GitHub Pages

Upload these files to the root of your public GitHub repository:

- `index.html`
- `styles.css`
- `app.js`
- `config.js`

Keep `supabase-setup.sql` and this README in the repository if desired. In **Settings → Pages**, deploy from the `main` branch and `/ (root)` folder.

## What is working

- Shared product listings visible to all visitors
- Email/password registration and login
- Email-confirmation-compatible signup flow
- Product submission restricted to authenticated users
- Product image uploads to Supabase Storage
- Public external purchase links
- Search, category filtering, sorting, and creator statistics
- Database-level Row Level Security
- Click counter using a controlled database function

## Production recommendations

Before promoting the site widely, add product moderation, reporting, CAPTCHA/rate limiting, a privacy policy, terms, prohibited-product rules, and an admin workflow. Consider disabling automatic publishing by changing the database default for `is_published` to `false` and approving submissions manually.
