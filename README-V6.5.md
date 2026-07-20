# LaunchBoard v6.5 — Messaging RLS and Creator Search

## Critical database fix

The error `infinite recursion detected in policy for relation conversation_members`
cannot be fixed by JavaScript alone.

Run:
`supabase-v6.5-messaging-rls-fix.sql`

in Supabase Dashboard → SQL Editor.

The script replaces the recursive policy with a SECURITY DEFINER membership helper.

## App improvements

- Search existing conversations.
- Tap New to search creators.
- Following tab shows creators you follow.
- All creators tab shows the creator directory.
- Start a direct conversation from the Message button.
- Cleaner mobile conversation layout.

## Upload

Replace:
- messages.html
- messages.js
- styles.css

Then run the SQL file and clear the Android app/WebView cache.
