# Client support ticket integration

The client portal now uses the deployed CRM API support routes:

- `GET /portal/support` — list tickets for the authenticated client.
- `POST /portal/support` — create a ticket for a project belonging to the authenticated client.
- `GET /portal/support/{id}` — view ticket details and replies.
- `POST /portal/support/{id}/replies` — add a reply (available in the API; a dedicated reply composer can be added separately).

The browser submits `projectId`, `subject`, `description`, `category`, and `priority`. Client identity is derived by the API from the bearer token; the browser does not submit a client ID. Screenshot/file attachments are currently not uploaded because the API endpoint accepts JSON, not multipart file content.

After deployment, sign in to the portal and submit a test request. Confirm it appears in the staff CRM Support tickets inbox, then test staff replies and status changes.
