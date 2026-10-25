# Backend integration status

## Connected to the current shared CRM API
- API base: `https://api.zyma.co.za/api/crm`
- Login: `POST /auth/login`
- Client identity: `GET /portal/me` (protected, Client role)
- Client projects: `GET /portal/projects`
- Approved milestones: `GET /portal/projects/{id}/milestones`
- Bearer token is stored in `sessionStorage` for the current tab and removed on sign-out.
- The portal derives client scope on the server. The browser does not submit a client ID for authorization.
- The portal accepts the current `/portal/me` response, which does not include a role field, because that endpoint itself is protected by the Client role.

## Not yet connected
The current API does not expose these endpoints, so the frontend intentionally does not pretend they work:
- Project development updates: `GET /portal/updates?projectId={projectId}`
- Support tickets: `GET/POST /support/tickets`
- Client invitation activation: `POST /invitations/accept`
- Password reset: `POST /auth/forgot-password` and `POST /auth/reset-password`

The support buttons show an explanatory message until support-ticket persistence is implemented. Updates remain an empty state until the backend endpoint exists. Registration and password reset pages remain present but are not operational without their server endpoints.

## Security requirements
- Keep every client endpoint protected by the `Client` role.
- Derive client scope from the authenticated `CrmUser.ClientId` on every request.
- Return only milestones with `IsApprovedForClientView == true`.
- Never trust a client ID sent by the browser.
- Do not store JWTs in `localStorage`; this frontend uses tab-scoped `sessionStorage`.
