# IT & Communications Asset Management

The repository contains first-party authentication, account provisioning,
location scope management, and an initial hardware asset register backed by
PostgreSQL. This is still an incomplete application; do not use it as a
production system.

## Development

Client (React, TypeScript, Vite):

```sh
cd client
pnpm install
pnpm dev
```

API (NestJS, TypeScript):

```sh
cd server
npm install
npm run prisma:generate
npm run start:dev
```

Set `DATABASE_URL`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` in
`server/.env` before starting the API. Generate separate secrets of at least
32 characters. Apply reviewed migrations with `npm run prisma:migrate:deploy`.
The liveness endpoint is `GET /api/v1/health`. Migrations require an existing
PostgreSQL database.

After the migration is applied, create the initial organization and
Administrator from an interactive terminal with `npm run admin:bootstrap`.
The command asks for a temporary password without echoing it and refuses to
run after an Administrator has been created. The resulting organization ID is
needed at sign-in. Administrators can create users, assign one role, and
change or reset roles/passwords, deactivate accounts, and reactivate accounts
with a new temporary password from the Users page. New users must change their
temporary password at sign-in.
Administrators can also create the approved Location tree and attached Stores,
and grant Location subtrees to Asset Manager and Procurement/Finance users.
Those grants include descendant Locations and their Stores; grant/revocation
history is retained indefinitely.

Access tokens are held in memory; rotating refresh tokens use an HTTP-only
cookie. Password changes require at least 8 characters and revoke active
sessions. Administrators can create asset categories. Asset Managers can
register received equipment and read the asset register only within their
assigned Location subtrees. Direct asset registration does not create a
receiving record; the API does not yet support assignments, transfers, repairs,
or lifecycle/availability transitions.

Asset Managers may edit descriptive metadata within the same organization and
assigned Location scope using `PUT /api/v1/assets/:assetId/profile`. This is a
complete profile edit: all five string fields (`manufacturer`, `model`,
`serialNumber`, `sourceReference`, `notes`) are required. Values are trimmed;
empty strings clear stored values to null. The first four fields are limited
to 150 characters and notes to 2000. Other fields are rejected, including
organization, tag, category, location, state, custody, and body versions.
There is no generic asset PATCH endpoint.

The update requires `If-Match: "1"` (the quoted positive integer `version`
from the asset read response). Missing, wildcard, weak, multiple, or malformed
versions return 400; inaccessible assets return 404; stale versions return 409.
The conditional write includes organization, assigned Locations, and version,
and increments version atomically. The returned body is the updated asset.
No database schema or migration changes are needed for profile editing.

The detail form keeps drafts and their original versions on rejected updates
and background refetches. On conflict, load the latest profile for comparison
without losing input; explicitly discard the draft to edit the reviewed
version. Network failures and server errors with an unknown outcome require
reviewing the server profile before retrying.
Business audit infrastructure remains a gap; profile editing adds no audit
or outbox claims and does not enable any receiving or state workflow.

The asset-register migration is additive and has not been applied by this
development task. Apply reviewed migrations only to an approved PostgreSQL
database. Public registration, receiving, custody, movements, maintenance,
verification workflows, and other role-specific domain access remain
unimplemented.

Read `AGENTS.md` and the product, frontend, and backend requirements before
implementing domain behavior. Those requirements are proposed; unresolved
business decisions must be approved before they are encoded in the product.
