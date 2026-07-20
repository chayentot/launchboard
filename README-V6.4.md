# LaunchBoard v6.4 — Messages Fix

Fixes the Supabase error:

Could not find a relationship between conversation_members and profiles in the schema cache.

The previous query depended on a database relationship that does not exist in Supabase's schema cache.

## New message loading method

The app now loads:
1. Current user's conversation IDs
2. Conversations
3. Conversation members
4. Profiles
5. Product titles

These records are combined safely in JavaScript, so no embedded relationship is required.

## Mobile improvements

- Compact conversation list
- Avatar and creator name
- Product title preview
- Clear empty-message state
- Mobile-sized chat area and send form

## Replace

- messages.js
- styles.css

Clear the Android app/WebView cache after uploading.
