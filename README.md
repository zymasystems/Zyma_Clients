# Zyma Client Portal

Standalone client-facing frontend for GitHub Pages at `portal.zyma.co.za`.

## Pages and workflows
- `index.html` / `client-login.html`: client sign-in.
- `client-register.html`: invitation-based account activation.
- `client-forgot-password.html`: request a password-reset email.
- `client-reset-password.html`: set a new password from a single-use reset token.
- `client-portal.html`: project overview, application details, published milestones, development updates, and support/maintenance requests.

## Shared API
The frontend expects the shared ASP.NET Core API at `https://api.zyma.co.za` by default. Override it before the page scripts run with `window.ZYMA_PORTAL_CONFIG = { apiBaseUrl: "https://your-api-host" }`.

Expected endpoints include:
- `POST /api/auth/login` and `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/invitations/accept`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `GET /api/portal/projects`
- `GET /api/portal/updates?projectId={id}`
- `GET/POST /api/support/tickets`

The API must scope project, update and support-ticket results to the authenticated client's organization. Do not trust a client ID or organization name sent by the browser.

## Deployment
1. Push the contents of this folder to `Zyma_Client_Portal`.
2. Configure GitHub Pages to deploy `main` from `/ (root)`.
3. Set the custom domain to `portal.zyma.co.za`; configure DNS using the current GitHub Pages instructions and enable HTTPS.
4. Configure the API CORS allow-list to include `https://portal.zyma.co.za` and `https://crm.zyma.co.za`.

## Current integration state
This repository contains frontend workflows only. Authentication, invitation verification, password reset, project data and support-ticket persistence require the API described above. The portal intentionally does not seed client identities, projects, progress, milestones, updates or tickets.
