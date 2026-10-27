# Backend integration status

## Connected to the current shared CRM API
- API base: `https://api.zyma.co.za/api/crm`
- Login: `POST /auth/login`
- Client identity: `GET /portal/me` (protected, Client role)
- Client projects: `GET /portal/projects`
- Approved milestones: `GET /portal/projects/{id}/milestones`
- Client-safe development tasks: `GET /portal/projects/{id}/tasks` (project ownership is checked server-side; staff assignment and internal priority are not returned)
- Project detail/progress: `GET /portal/projects/{id}`; the portal reads `progressPercentage` and refreshes the selected project, tasks, milestones and published updates approximately every 60 seconds while visible
- Bearer token is stored in `sessionStorage` for the current tab and removed on sign-out.
- The portal derives client scope on the server. The browser does not submit a client ID for authorization.
- The portal accepts the current `/portal/me` response, which does not include a role field, because that endpoint itself is protected by the Client role.

## Project development updates
- `GET /portal/updates?projectId={projectId}` is implemented in the shared API.
- The portal requests updates for the selected project, refreshes the feed every 60 seconds while the page is visible, and sorts updates by publication time (newest first).
- The API returns only updates where `IsPublishedToClient == true` and verifies that the requested project belongs to the authenticated client's `ClientId`.
- Staff must create a project update in the CRM and explicitly publish it before it appears in the client portal.
- The portal displays the published timestamp (`PublishedAtUtc`) when supplied by the API.

## Not yet connected
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


## Client invitation activation endpoint

The deployed CRM API exposes client invitation redemption at:

`POST /api/crm/client-invitations/accept`

The activation page's `client-auth.js` must use `/client-invitations/accept` relative to the configured API base (`https://api.zyma.co.za/api/crm`). The older `/invitations/accept` path does not match the API controller route.

The activation email must match the email address stored on the CRM client record and invitation. Each activated account is linked to the invitation's `ClientId`; the portal must load project data from the authenticated `/portal/projects` API and must not use a hardcoded demo client or client ID.


## Client profile editing (required API work)
The portal profile editor reads the authenticated identity from `GET /portal/me` and submits editable contact/company fields to `PATCH /api/crm/portal/profile`. The backend must resolve the client and primary contact from the authenticated user/session; it must never accept a client ID or contact ID from the browser as authorization. Update the linked CRM contact and client organization transactionally, validate email/URL/phone lengths, enforce field-level allowlists, audit the change, and return the updated safe profile. Do not allow changes to account role, login email identity unless a verified email-change flow exists, internal notes, relationship ownership, client IDs, project assignments, or staff-only fields. The frontend displays a clear API-unavailable message if the endpoint is not implemented; a browser-only save is deliberately not used because it would not update the CRM source of truth.

Suggested response shape: `{ "profile": { "fullName", "jobTitle", "department", "companyRole", "email", "alternateEmail", "phone", "mobile", "preferredContact", "linkedin", "companyName", "industry", "companyWebsite", "companyEmail", "companyPhone", "companySize", "registrationNumber", "vatNumber", "address", "city", "province", "postalCode", "country" } }`. `GET /portal/me` should return the same editable fields for pre-filling the profile form.

Project summary fields expected by the portal: `code`/`reference`, `scope` and/or `scopeItems`, `managerName`/`projectLead`, `startDate`, `targetDate`, `status`/`phase`. These should be returned only for projects linked to the authenticated client's organization.
