# LaunchBoard V4.1 installation

## Before replacing files

Keep a copy of your current `config.js`; it contains your real Supabase URL and publishable key.

## 1. Run the database migration

In Supabase:

1. Open **SQL Editor**.
2. Select **New query**.
3. Paste all of `supabase-v4.1-migration.sql`.
4. Click **Run**.

The migration preserves existing users and products and can be run more than once.

## 2. Make your account an administrator

After your account exists, run:

```sql
update public.profiles
set is_admin=true
where id=(
  select id from auth.users
  where lower(email)=lower('tantanplays@gmail.com')
);
```

## 3. Replace GitHub files

Upload every HTML and JavaScript file plus `styles.css` from this package to the repository root.

Do not replace your working `config.js` with the placeholder from this ZIP.

## 4. Refresh

After GitHub Pages deploys, open:

`https://chayentot.github.io/launchboard/?v=4.1`

Private admin page:

`https://chayentot.github.io/launchboard/admin.html?v=4.1`
