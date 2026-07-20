# LaunchBoard v7 — Mobile Messenger Experience

## Messages
- Messenger-style conversation list
- Circular creator avatars
- Recent conversation timestamps
- Compact mobile chat header
- Rounded chat bubbles
- Sticky composer with Send button
- Creator search and Following/All creators remain available

## Guest authentication visibility
- New users now see Log in and Sign up directly in the mobile header
- Signed-in users continue to use the account/profile menu

## Required database step
Messaging still requires the Supabase policy repair from v6.5.1:
`supabase-v6.5.1-messaging-policy-repair.sql`

## Replace
- messages.html
- messages.js
- common.js
- index.html
- styles.css
