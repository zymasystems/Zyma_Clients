# Zyma Client Portal

Standalone client-facing frontend for GitHub Pages at `portal.zyma.co.za`.

## Pages and workflows
- `index.html` / `client-login.html`: client sign-in.
- `client-register.html`: invitation-based account activation.
- `client-forgot-password.html`: request a password-reset email.
- `client-reset-password.html`: set a new password from a single-use reset token.
- `client-portal.html`: project overview, application details, and published milestones. Development updates and support tickets require additional backend endpoints.

## Shared API
The frontend defaults to the CRM API base `https://api.zyma.co.za/api/crm`. It uses the existing ASP.NET Core JWT login endpoint at `POST /auth/login` and keeps the bearer token in `sessionStorage` for the current browser tab only. Override it before the page scripts run with `window.ZYMA_PORTAL_CONFIG = { apiBaseUrl: "https://your-api-host" }`.

Implemented endpoints used by this frontend:
- `POST /auth/login`
- `GET /portal/me`
- `GET /portal/projects`
- `GET /portal/projects/{id}/milestones`

Planned endpoints not yet implemented:
- Invitation activation and password reset
- Project updates
- Support ticket listing and submission

The API must scope project, update and support-ticket results to the authenticated client's organization. Do not trust a client ID or organization name sent by the browser.

## Deployment
1. Push the contents of this folder to `Zyma_Client_Portal`.
2. Configure GitHub Pages to deploy `main` from `/ (root)`.
3. Set the custom domain to `portal.zyma.co.za`; configure DNS using the current GitHub Pages instructions and enable HTTPS.
4. Configure the API CORS allow-list to include `https://portal.zyma.co.za` and `https://crm.zyma.co.za`.

## Current integration state
The login and the client identity/project/approved-milestone views are wired to the current CRM API. Invitation activation, password reset, project updates and support-ticket persistence still require backend endpoints. The portal does not seed client identities, projects, progress, milestones, updates or tickets.
