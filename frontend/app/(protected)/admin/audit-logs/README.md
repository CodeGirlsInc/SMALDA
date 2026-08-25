# Admin Audit Logs (FE-63)

Admin-only page that lists access/audit logs from `GET /admin/access-logs`.

## Columns

Each row shows `routePath`, `httpMethod`, `ipAddress` and `createdAt`.

## Filters

The table supports filtering by `userId` and a `createdAt` date range; filter
values are passed as query params to the access-logs endpoint and the table is
paginated.

## Access

The route lives under `(protected)/admin`, so it is only reachable by admins
(guarded per FE-44).
