# Client-to-project matching and development updates

## Match a client to the correct project
1. In Zyma CRM, open **Projects** and edit the relevant project.
2. Set the project's **Client** to the exact client record that owns the portal account.
3. Save the project.
4. Ensure the portal user is linked to that same client record (`CrmUser.ClientId`). The portal API scopes projects and updates using the authenticated user's client identity; do not add a client ID to browser requests or bypass server-side checks.
5. Sign in to the portal as that client. The project should appear under **My application**. If the client owns multiple projects, the project selector should allow switching between them.

## Publish a development update
1. In Zyma CRM, open the matched project and create a **Project Update**.
2. Enter a clear title and body describing the work completed, current progress, blockers, or next steps.
3. Save the update as a draft.
4. Use **Publish** on that update. Drafts are not visible to clients.
5. The portal reads `GET /api/crm/portal/updates?projectId={projectId}` and displays published updates newest-first. It refreshes while visible approximately every 60 seconds; refreshing the portal also fetches the latest updates.

## Expected behaviour
- A client sees only projects associated with its own CRM client record.
- A client sees only published updates belonging to the selected project.
- Updates from another client's project must not be visible.
- If the feed says “No project updates have been published,” the project is linked but no updates have been published yet.
