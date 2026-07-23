LaunchBoard V9.2 — Mobile Account Menu + Creator Onboarding

FILES TO UPLOAD
- common.js
- dashboard.html
- dashboard.js
- dashboard-responsive.css
- styles.css
- onboarding.html (new)
- onboarding.js (new)

FEATURES
1. Mobile dashboard now includes Edit profile, View profile, Saved products, Following, and Log out.
2. Every account created after this patch is redirected to creator onboarding.
3. New users must follow at least 5 creators before Continue is enabled.
4. The global onboarding gate redirects incomplete new users back to onboarding.html.
5. Existing accounts are not forced into onboarding.

IMPORTANT
- The existing Supabase creator_follows table and its insert/delete/select RLS policies must remain enabled.
- Upload onboarding.html and onboarding.js before common.js to avoid a temporary missing-page redirect.
- After deployment, hard refresh or clear the service-worker cache.
