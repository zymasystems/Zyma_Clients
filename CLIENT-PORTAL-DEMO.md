# Client portal workflow and API contract

The portal is designed to display only data returned by the shared API for the authenticated client organization. No client records, project progress, milestones, development updates or support requests are pre-populated in this frontend.

## User workflows
1. A Zyma staff member creates/validates a client and project in the internal CRM.
2. Authorized staff invite a client contact through the API.
3. The contact opens the invitation link and completes account activation at `client-register.html`.
4. The client signs in at `client-login.html`.
5. The portal requests the authenticated identity, the projects assigned to that organization, published project updates and support tickets.
6. The client can submit an error, assistance, maintenance or change request. The API creates a ticket and returns its reference/status.
7. The client can request password recovery and set a new password using a single-use expiring token.

## Required server-side protections
- Invitation tokens must be random, single-use, expire, and be stored as hashes.
- Passwords must be hashed server-side; never store passwords in browser storage.
- Every portal endpoint must derive organization access from the authenticated session, not from user-supplied organization IDs.
- File attachments must be validated, size-limited, stored securely and scanned where available.
- Return generic password recovery responses and rate-limit login, invitation acceptance and recovery.

The API is not implemented in this repository; endpoints are integration targets, not currently live services.
