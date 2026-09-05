# Pipeline Task Decomposition

## Summary
**StockRoom** is a small-warehouse inventory system built on the scaffolded Enterprise stack (Angular 19 standalone SPA + NestJS 11 + Prisma/PostgreSQL 16). Staff sign in, browse a catalogue of items with live on-hand quantities derived from per-location stock levels, and record stock movements (`IN`, `OUT`, `TRANSFER`) through a two-step, deep-linkable wizard that atomically adjusts balances and refuses to oversell. Elevated users (manager/admin) additionally manage items and locations, read a paginated, filterable audit log of every movement, and view a low-stock report driven by each item's reorder threshold. Every list filter, detail tab and wizard step lives in the URL so all views survive a hard refresh. Admin settings expose the provisioned backing services (PostgreSQL, MinIO) for credential configuration.

## Surface contract

### REST API (all under the `api` global prefix; `@Public()` where noted)
| Method | Path | Access |
|---|---|---|
| GET | `/api/health` | public |
| GET | `/api/health/deep` | public (runs `SELECT 1`, returns `{status, db}`) |
| POST | `/api/auth/signup` | public → creates `USER` (clerk) role |
| POST | `/api/auth/login` | public → `{accessToken, user:{id,email,role}}` |
| GET | `/api/auth/me` | any authenticated |
| GET | `/api/items?q=&lowStock=` | any authenticated |
| GET | `/api/items/:id` | any authenticated (item + `locations[]` + `qtyOnHand`) |
| POST/PATCH/DELETE | `/api/items[/:id]` | manager/admin |
| GET | `/api/locations` | any authenticated |
| POST/PATCH/DELETE | `/api/locations[/:id]` | manager/admin |
| POST | `/api/movements` | any authenticated |
| GET | `/api/movements?itemId=&type=&from=&to=&page=` | manager/admin (50/page, returns `total`) |
| GET | `/api/reports/low-stock` | manager/admin |
| GET | `/api/admin/settings` | admin |
| PATCH | `/api/admin/settings` | admin |

### SPA routes (each carries `data: { flow: '<name>' }`)
| Path | Guard | URL-held state |
|---|---|---|
| `/login`, `/signup` | public | — |
| `/items` | auth | `?q=&lowStock=` |
| `/items/new`, `/items/:id/edit` | manager | — |
| `/items/:id` | auth | `?tab=locations\|movements` |
| `/locations` | auth | — |
| `/locations/new`, `/locations/:id/edit` | manager | — |
| `/movements/new` | auth | `?step=1\|2&type=IN\|OUT\|TRANSFER&itemId=` |
| `/movements` | manager | `?itemId=&type=&from=&to=&page=` |
| `/reports/low-stock` | manager | — |
| `/admin/settings` | admin | — |
| `/` | — | redirect → `/items` (anon bounced to `/login`) |

### Entities
`User(id, email @unique, name?, passwordHash, role, createdAt, updatedAt)` · `ColossusAccount` (already scaffolded, platform-owned) · `Item(id, sku @unique, name, description?, unit, reorderAt Int, createdAt)` · `Location(id, name, zone, @@unique([name, zone]))` · `StockLevel(id, itemId, locationId, qty Int @default(0), @@unique([itemId, locationId]))` · `Movement(id, type, itemId, fromLocId?, toLocId?, qty Int, note?, userId, createdAt)` · `SystemSetting(key @id, value, updatedAt)` · enums `Role { USER MANAGER ADMIN }`, `MovementType { IN OUT TRANSFER }`.

### Role mapping (scaffold contract wins over the spec's wording)
The scaffolded contract declares `Role { USER MANAGER ADMIN }` and Colossus mints one login per role. The spec's **clerk** = `USER`; the spec's **manager** = `MANAGER` **and** `ADMIN` (admin is a superset and passes every manager check). Every file stays within the scaffold's 400-line budget (500 hard limit).

## db_agent tasks
- [ ] Add `enum MovementType { IN OUT TRANSFER }` to `backend/prisma/schema.prisma`; keep the existing `enum Role { USER MANAGER ADMIN }` and `User.role Role @default(USER)` unchanged (full_auth: signup-created users default to `USER`).
- [ ] Add `Item` model to `schema.prisma`: `id String @id @default(uuid())`, `sku String @unique`, `name`, `description String?`, `unit`, `reorderAt Int`, `createdAt`; relations to `StockLevel[]` and `Movement[]`.
- [ ] Add `Location` model: `id`, `name`, `zone`, `@@unique([name, zone])`, `createdAt`; relations to `StockLevel[]` plus `movementsFrom`/`movementsTo`.
- [ ] Add `StockLevel` model: `itemId`, `locationId`, `qty Int @default(0)`, `@@unique([itemId, locationId])`, relations to `Item` and `Location` with `onDelete: Restrict`.
- [ ] Add `Movement` model: `type MovementType`, `itemId`, `fromLocId String?`, `toLocId String?`, `qty Int`, `note String?`, `userId`, `createdAt`, `@@index([itemId, createdAt])`, `@@index([createdAt])`; all relations `onDelete: Restrict` so item/location deletes are blocked at the DB level.
- [ ] Add `SystemSetting` model: `key String @id`, `value String`, `updatedAt DateTime @updatedAt` (backs admin settings for the provisioned `postgresql` and `minio` services).
- [ ] Generate and commit the Prisma migration for all of the above (`prisma migrate dev --name stockroom_inventory`) and confirm `npx prisma generate` succeeds.
- [ ] Extend `backend/prisma/seed/seed.js` (idempotent upserts, must keep consuming `COLOSSUS_ACCOUNTS_JSON` for `User` + `ColossusAccount` rows): 3 locations (`Zone A`, `Zone B`, `Zone C`), 8 items `SKU-001`..`SKU-008` with realistic name/unit/reorderAt, including one item stocked across two locations and one item at/below its `reorderAt`.
- [ ] In the same seed, record opening balances as real `IN` `Movement` rows attributed to the MANAGER account and upsert the matching `StockLevel` quantities, so the audit log and low-stock report are both non-empty on first load; re-running the seed must not double balances.

## backend_agent tasks
- [ ] In `backend/src/main.ts`: add `app.setGlobalPrefix('api')` (keep Swagger mounted at `api/docs`) and a global `ValidationPipe({ whitelist: true, transform: true })`; keep CORS and `PORT` handling as scaffolded.
- [ ] Create `backend/src/auth/` module: `jwt.strategy.ts` (HS256, `JWT_SECRET`, 12h), `jwt-auth.guard.ts` registered as `APP_GUARD` so every endpoint is 401 by default, `decorators/public.decorator.ts`, `decorators/roles.decorator.ts`, `decorators/current-user.decorator.ts`.
- [ ] Implement `auth.service.ts` + `auth.controller.ts`: `POST /api/auth/signup` (email, password ≥8 chars → bcrypt hash, `role: USER`, 409 on duplicate email), `POST /api/auth/login` (bcrypt compare, 401 on failure), `GET /api/auth/me`; DTOs `dto/login.dto.ts`, `dto/signup.dto.ts`.
- [ ] Add `roles.guard.ts` as a second `APP_GUARD` reading `@Roles(...)` → 403; treat `ADMIN` as satisfying any `MANAGER` requirement.
- [ ] Rework `backend/src/health/health.controller.ts` to expose `@Public()` `GET /api/health` → `{status:'ok'}` and `GET /api/health/deep` → `SELECT 1` via `PrismaService` → `{status, db}`.
- [ ] Create `backend/src/items/` module/service/controller with `dto/create-item.dto.ts` and `dto/update-item.dto.ts`; `GET /api/items` returns each item with `qtyOnHand` (sum of its `StockLevel.qty`) and `isLow` (`qtyOnHand <= reorderAt`), supporting `?q=` (sku/name contains, case-insensitive) and `?lowStock=true`.
- [ ] Add `GET /api/items/:id` returning the item plus `locations[] {locationId, name, zone, qty}` and `qtyOnHand`; 404 when unknown.
- [ ] Add `POST/PATCH/DELETE /api/items` under `@Roles(MANAGER, ADMIN)`; map Prisma `P2002` on `sku` → `400 {message:'SKU already exists'}`; delete → `409` when any `Movement` or `StockLevel` references the item.
- [ ] Create `backend/src/locations/` module/service/controller + create/update DTOs: `GET /api/locations` for any authenticated caller; `POST/PATCH/DELETE` under `@Roles(MANAGER, ADMIN)`; delete → `409` when stock levels or movements reference the location.
- [ ] Implement `backend/src/movements/dto/create-movement.dto.ts` type-conditional validation: `IN` requires `toLocId` and forbids `fromLocId`; `OUT` requires `fromLocId` and forbids `toLocId`; `TRANSFER` requires both with `fromLocId !== toLocId`; `qty` is `@IsInt @Min(1)`; `note` optional.
- [ ] Implement `POST /api/movements` in `movements.service.ts` inside `prisma.$transaction`: credit via `stockLevel.upsert({ update: { qty: { increment } } })`; debit via conditional `updateMany({ where: { itemId, locationId, qty: { gte: qty } }, data: { qty: { decrement } } })` and throw `BadRequestException('Insufficient stock')` when `count === 0` so the transaction rolls back untouched; then create the `Movement` row with `userId` from the JWT.
- [ ] Implement `GET /api/movements` under `@Roles(MANAGER, ADMIN)` with `dto/query-movements.dto.ts` filters `itemId`, `type`, `from`, `to`, `page` (50/page); return entries with `user.email`, `item.sku`/`item.name`, from/to location names, `qty`, `type`, `createdAt`, plus `total`.
- [ ] Create `backend/src/reports/` module/service/controller: `GET /api/reports/low-stock` under `@Roles(MANAGER, ADMIN)` — groupBy `itemId` summing `qty`, join items, keep `onHand <= reorderAt` (items with no stock rows count as 0), sorted by deficit descending.
- [ ] Create `backend/src/lib/config.ts` exporting `resolveConfig(key: string): Promise<string | null>` — reads `process.env[key]` first; falls back to the `SystemSetting` row when the env value is absent or equals `PLACEHOLDER_CONFIGURE_IN_SETTINGS`; returns `null` when neither is set.
- [ ] Create `backend/src/admin/` module: `GET /api/admin/settings` (admin only) listing every `postgresql` and `minio` credential key with masked values and a `configured` boolean, and `PATCH /api/admin/settings` (admin only) upserting key/value pairs into `SystemSetting`.
- [ ] Remove the scaffolded placeholder surface that StockRoom replaces: `backend/src/users/*` tRPC router/service and the `/trpc/users.*` procedures, updating `app.module.ts` (and `trpc.router.ts`) so nothing dangles; keep the tRPC module itself only if it still has a consumer, otherwise unregister it.

## ui_agent tasks
- [ ] Rewrite `frontend/src/app/app.component.ts` as the shell: literal brand text **"StockRoom"** in the header, nav links (`Items`, `Locations`, `Record movement`, plus `Audit log`, `Low stock` and `Admin settings` shown only when `authService.isManager()` / admin), user email chip and a logout button; set `<title>StockRoom</title>` in `frontend/src/index.html`.
- [ ] Write `frontend/src/app/app.routes.ts` for the full route table above with `provideRouter(routes, withComponentInputBinding())` in `app.config.ts`, lazy `loadComponent` per feature and `data.flow` on every route; `/` redirects to `/items`, unknown paths fall back to `/items`.
- [ ] Add `core/auth.guard.ts` (redirect anon → `/login` preserving `returnUrl`) and `core/manager.guard.ts` (non-manager → `/items`); apply them per the route table.
- [ ] Build `features/auth/login.component.ts`: card headed **"StockRoom"**, email/password reactive form, inline 401 error, hint pointing at the platform-provisioned accounts, link to `/signup`.
- [ ] Build `features/auth/signup.component.ts`: email/password (≥8) reactive form, inline 409 duplicate-email error, auto-login on success then navigate to `/items`.
- [ ] Build `features/items/item-list.component.ts`: table of sku, name, unit, reorder threshold, qty on hand and low-stock badge; search box and low-stock toggle bound to `?q=`/`?lowStock=` via component inputs, writing back with `queryParamsHandling:'merge'`; "New item" button only for managers; empty/loading/error states.
- [ ] Build `features/items/item-detail.component.ts`: header stats (sku, unit, reorderAt, qty on hand) and `?tab=locations|movements` switching between the per-location quantity breakdown (with a total row proving the sum equals on-hand) and that item's recent movements; "Record movement" link prefilled with `itemId`.
- [ ] Build `features/items/item-form.component.ts` for `/items/new` and `/items/:id/edit`: reactive form over sku/name/description/unit/reorderAt, surfacing the duplicate-SKU 400 on the `sku` control, plus a manager-only delete action that shows the 409 in-use message.
- [ ] Build `features/locations/location-list.component.ts` and `location-form.component.ts` mirroring the item screens for name + zone, including the 409 delete-blocked message.
- [ ] Build `features/movements/movement-new.component.ts` as a two-step wizard: step 1 picks item + type, step 2 shows only the from/to selects the type requires plus qty and note; every step restored from `?step=`/`?type=`/`?itemId=` so back/forward and deep links work; render the server's "Insufficient stock" error inline without clearing the form.
- [ ] Build `features/movements/movement-log.component.ts`: filter bar (item, type, from/to date) bound to query params, paginated table (50/page) of user email, item, type, qty, from → to, timestamp, with empty and error states.
- [ ] Build `features/reports/low-stock.component.ts`: table of sku, name, on hand, reorderAt, deficit, each row linking to `/movements/new?itemId=…&type=IN`; empty state when nothing is low.
- [ ] Build `features/admin/settings.component.ts` at `/admin/settings`: one section per provisioned service (`postgresql`, `minio`) with a configured/unconfigured badge and a credential form per service; show the banner "The following need credentials to activate: …" listing every unconfigured service returned by the API.
- [ ] Delete the scaffolded `frontend/src/app/home/home.component.ts` demo screen and any references to it once `/items` is the landing route.

## service_agent tasks
- [ ] Write `frontend/src/app/core/models.ts` with the shared TypeScript types (`User`, `Role`, `Item`, `ItemDetail`, `Location`, `StockLevel`, `Movement`, `MovementType`, `MovementPage`, `LowStockRow`, `SettingsEntry`) matching the REST payloads in the surface contract.
- [ ] Write `frontend/src/app/core/auth.service.ts`: signal-based `user`, `isManager`, `isAdmin`; `login()`, `signup()`, `logout()`, `loadMe()`; persists the JWT in `localStorage` and restores the session on boot.
- [ ] Write `frontend/src/app/core/auth.interceptor.ts` and register it via `provideHttpClient(withInterceptors([authInterceptor]))`: attaches `Authorization: Bearer <token>` and on 401 clears the session and redirects to `/login`.
- [ ] Write `frontend/src/app/core/api/items.service.ts`: `list({q, lowStock})`, `get(id)`, `create()`, `update()`, `remove()` against `/api/items`.
- [ ] Write `frontend/src/app/core/api/locations.service.ts`: `list()`, `create()`, `update()`, `remove()` against `/api/locations`.
- [ ] Write `frontend/src/app/core/api/movements.service.ts`: `create(dto)` and `list({itemId, type, from, to, page})` against `/api/movements`, returning `{entries, total, page}`.
- [ ] Write `frontend/src/app/core/api/reports.service.ts` (`lowStock()`) and `core/api/admin-settings.service.ts` (`list()`, `save(pairs)`) against `/api/reports/low-stock` and `/api/admin/settings`.
- [ ] Add a shared `core/api/http-error.ts` helper that normalises Nest error bodies into `{status, message, field?}` so components can surface "SKU already exists", "Insufficient stock" and 409 delete-blocked messages consistently.
- [ ] Confirm the frontend API base is `/api` for both `ng serve` (`frontend/proxy.conf.json`) and the nginx production build (`frontend/nginx.conf` proxying `/api` to the backend, SPA fallback for all other paths).

## tester tasks
- [ ] `backend/test/auth.e2e-spec.ts`: unauthenticated calls to `/api/items`, `/api/locations`, `/api/movements`, `/api/reports/low-stock` all return 401; signup → login → `/api/auth/me` round-trip succeeds; duplicate signup email → 409; wrong password → 401.
- [ ] `backend/test/rbac.e2e-spec.ts`: clerk (`USER`) `POST /api/items` → 403 and `GET /api/movements` → 403; manager create → 2xx; duplicate SKU create → 400 `SKU already exists`; non-admin `GET /api/admin/settings` → 403.
- [ ] `backend/test/movements.e2e-spec.ts` balances: `IN` 50 → on hand 50; `OUT` 20 → 30; `TRANSFER` 10 → A=20/B=10 with total unchanged at 30.
- [ ] `backend/test/movements.e2e-spec.ts` oversell guard: `OUT` 10 against 5 on hand → 400 "Insufficient stock" **and** a re-read confirms the balance is still 5 and no `Movement` row was written.
- [ ] `backend/test/reports.e2e-spec.ts`: item with `reorderAt` 10 and 12 on hand appears in low-stock after `OUT` 5; an item with 40 on hand is absent; deficit ordering is descending.
- [ ] `backend/test/movements.e2e-spec.ts` audit query: filtering by `itemId` and by `from`/`to` date range returns only matching rows, `total` is accurate, and pagination caps at 50 per page.
- [ ] `backend/test/health.e2e-spec.ts`: `/api/health` → `{status:'ok'}` without a token; `/api/health/deep` reports `db` ok.
- [ ] `frontend/e2e/smoke.spec.ts` (Playwright): anonymous load of `/` shows text "StockRoom" and the sign-in form; log in as clerk → item list renders; record a movement → the item detail balance updates; log in as manager → audit log and low-stock report reachable; clerk navigating to `/movements` is redirected to `/items`.
- [ ] `frontend/e2e/routes.spec.ts`: hard-reload every URL in the route table (including `/items/:id?tab=movements`, `/movements/new?step=2&type=TRANSFER&itemId=…`, `/movements?itemId=&page=2`) and assert the same view and filter state render.

## Open questions
- **REST vs tRPC.** The scaffold ships a tRPC glue (`glue.api_client: trpc`, `/trpc/users.*`) but the spec defines a REST surface under `/api`. These tasks follow the spec (REST + Swagger at `/api/docs`) and retire the placeholder tRPC users router. Confirm no downstream harness probes `/trpc`.
- **Role naming.** The spec says `Role { clerk manager }`; the scaffold contract fixes `Role { USER MANAGER ADMIN }` and Colossus mints one login per role. Tasks map clerk → `USER`, manager → `MANAGER`, with `ADMIN` inheriting manager rights. Confirm this is the intended mapping.
- **Seed accounts.** The spec asks for `manager@demo` / `clerk@demo` with `Demo1234!`; the scaffold requires the seed to materialise platform accounts from `COLOSSUS_ACCOUNTS_JSON`. Tasks keep the platform accounts as the only logins and drop the hard-coded demo credentials — so the login-screen "demo credentials" hint points at the provisioned accounts instead.
- **Packaging.** The spec describes a single container with `ServeStaticModule` serving Angular from `public/`; the scaffold uses split `backend` + nginx `frontend` Docker targets. Tasks keep the scaffolded topology and only verify the `/api` proxy plus SPA fallback. Confirm before any Dockerfile rewrite.
- **MinIO.** `minio` is provisioned but the spec describes no object-storage behaviour (no attachments or item photos). It is exposed on `/admin/settings` for credential configuration only; flag if a feature was intended.
- **Signup and role escalation.** Signup always creates `USER`; there is no self-service promotion endpoint (spec explicitly defers a manager-only `PATCH /api/users/:id/role`). Confirm that admins never need to promote users in-app.
- **`TRANSFER` between the same item's missing stock row.** The spec does not say whether a transfer into a location with no existing `StockLevel` row should create one — tasks assume `upsert` creates it with the transferred quantity.
