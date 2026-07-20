# LaunchBoard V8.1.4

This focused release fixes the product-to-message mobile flow and removes duplicate mobile product actions.

## Changes

- **Message Creator** now creates or finds the conversation and opens the chat pane immediately.
- The product and creator IDs travel with the navigation request for reliable product context.
- Existing conversations are reused rather than duplicated.
- The chat composer receives focus after opening from a product.
- The product reference card remains visible at the top of the chat.
- **Visit product** is hidden on screens up to 760 px wide.
- The mobile sticky action area now contains one full-width **Message** button.
- Desktop external-product links remain unchanged.

No new Supabase migration is required for this focused update.
