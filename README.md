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

The asset-register migration is additive and has not been applied by this
development task. Apply reviewed migrations only to an approved PostgreSQL
database. Public registration, receiving, custody, movements, maintenance,
verification workflows, and other role-specific domain access remain
unimplemented.

Read `AGENTS.md` and the product, frontend, and backend requirements before
implementing domain behavior. Those requirements are proposed; unresolved
business decisions must be approved before they are encoded in the product.
