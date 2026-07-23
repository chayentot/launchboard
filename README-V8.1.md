# LaunchBoard V8.1 — Messaging and Product Notifications

## What changed

- Messages are now reserved for direct conversations only.
- New chat messages no longer create Notification Center entries.
- The Messages bottom-navigation item shows an unread conversation badge.
- Chat supports image and document attachments up to 15 MB.
- New products from followed creators appear in Notifications.
- Opening a product notification goes directly to the product page.
- Notifications were removed from the Profile/Dashboard area.
- Notification filters are now Products, Social, and System.
- Home section headings are left aligned and Recommended is a mobile horizontal rail.

## Required database update

Run `supabase-v8.1-messaging-products.sql` once in Supabase Dashboard → SQL Editor.

This migration creates:

- `conversation_reads`
- `message_attachments`
- the public `chat-attachments` Storage bucket
- follower new-product notification trigger
- policies for attachment and read-state access

It also removes the old message-to-notification trigger and deletes legacy message notifications.

## Deploy

Upload all files to the GitHub Pages repository, including the SQL migration for reference. Ensure `config.js` contains the production Supabase URL and anon key. After pushing, wait for the Pages workflow to complete successfully before testing.
