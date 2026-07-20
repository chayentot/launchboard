# LaunchBoard v7.3 — Stability and Polish

## Messages
- Shows the latest message in each conversation.
- Conversations sort by newest message.
- Local unread indicators appear for incoming messages.
- Opening a conversation marks it read on that device.
- Product context in the chat header links to the product.
- Android Back closes the open chat before leaving Messages.

## Android Back priority
1. Close open modal/filter sheet.
2. Close open chat.
3. Return an inner page to Home.
4. On Home, press Back twice to exit.

## Product view
- Adds compact Related Products below the product details.

## Required
Supabase messaging policy repair from v6.5.1 must already be applied.

## Replace
- messages.js
- common.js
- product.js
- styles.css
