# Development updates — backend dependency

The client portal already calls `GET /portal/updates?projectId={id}`, but the CRM API implementation was not included in this frontend repository and the endpoint was previously identified as not deployed. A frontend-only change cannot persist updates securely or enforce client/project isolation.

The staff publishing workflow requires authenticated staff endpoints to:

- list updates, with optional project/status filters;
- create a draft for a project;
- edit a draft;
- publish/unpublish an update;
- delete an update where authorized.

Suggested contract:

- `GET /project-updates?projectId={id}&status={draft|published}`
- `POST /project-updates` with `{ projectId, title, category, body, status }`
- `PUT /project-updates/{id}` with `{ title, category, body }`
- `PATCH /project-updates/{id}/publish` with `{ isPublished }`
- `DELETE /project-updates/{id}`
- Client portal: `GET /portal/updates?projectId={id}` must return published updates only and must derive the authorized client from the bearer token, verifying that the requested project belongs to that client.

Suggested fields: `Id`, `ProjectId`, `Title`, `Category`, `Body`, `Status` (`Draft`/`Published`), `CreatedByUserId`, `CreatedAtUtc`, `UpdatedAtUtc`, `PublishedAtUtc`. The backend must enforce staff authorization and project ownership. Do not use browser storage as the source of truth for published updates.
