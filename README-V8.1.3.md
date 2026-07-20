# LaunchBoard V8.1.3

## Product conversation reference

When a buyer taps **Message** from a product page, the resulting conversation now shows a prominent product reference card above the chat history.

The card includes:

- product image
- product name
- price
- creator name when available
- a direct **View product** link

No database migration is required for this update because the existing `conversations.product_id` relationship is used. Upload all files together so the cache-busted V8.1.3 assets are published.
