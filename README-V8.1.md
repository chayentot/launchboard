# LaunchBoard V8.1

This is the complete LaunchBoard website based on V8, with a focused Messages-page cleanup.

## Change in this release

- Removed the **Recent** heading above the conversation list.
- Conversations now begin immediately below the **Following** section.
- The conversation list remains ordered by latest activity and still shows each chat's latest-message preview and timestamp.
- Android Back-button behavior is unchanged in this package.

## Deployment

Upload every file in this package to the root of the GitHub Pages repository, replacing the previous website files. Keep `config.js` configured with the existing Supabase project credentials.


## V8.1.2 correction
- Removed the duplicate Notifications panel from the Profile/Dashboard page.
- Kept notifications exclusively in the dedicated Notification navigation tab.
- Left-aligned the New Today heading while keeping See all on the right.
- Added cache-busted asset versions so the corrected UI is loaded after deployment.
