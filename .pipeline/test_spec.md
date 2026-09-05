# Test Specification

> **WARNING — `.pipeline/surface.json` is stale and was NOT used as the API source of truth.**
> The committed `surface.json` still describes the untouched scaffold (`GET /health`,
> `GET /trpc/users.findAll`, `GET /trpc/users.findById`, and an `app-home` "Users" component).
> None of those routes exist in the approved StockRoom spec, and `tasks.md` explicitly retires
> the tRPC users router. This test spec therefore derives the API surface from the
> **Surface contract** table in `.pipeline/tasks.md` (which matches `requirements` spec Steps 3–8),
> and adds regression cases asserting the scaffold surface is *gone*.
> **Action for the pipeline:** regenerate `surface.json` from the StockRoom contract before
> any consumer trusts it.
>
> Two further reconciliations, both following `tasks.md` (scaffold contract wins over spec wording):
> - **Roles:** spec `clerk` → `USER`; spec `manager` → `MANAGER`, with `ADMIN` satisfying every
>   MANAGER check. Referred to below as **clerk**, **manager**, **admin**.
> - **Logins:** accounts come from `COLOSSUS_ACCOUNTS_JSON` (one per role), not the spec's
>   hard-coded `manager@demo` / `clerk@demo` / `Demo1234!`. Tests must read credentials from that
>   env var, never hard-code demo strings.
> - **Packaging:** split `backend` + nginx `frontend` images per `colossus.yaml`, not the spec's
>   single-container `ServeStaticModule`. Container tests target that topology.

## Coverage summary
- Total cases: 160 (131 API + 16 journey + 13 data integrity)
- API endpoints covered: 19 / 19 endpoints in the `tasks.md` surface contract (128 cases), plus 3 removal-regression cases for the stale `surface.json` routes (0 / 3 of which are in scope as live endpoints — see warning)
- User journeys covered: 16
- Counting rule: one case per `[API-nnn]` / `[JRN-nnn]` / `[DATA-nnn]` identifier. Journey negative paths are covered inside their journey case.

### Shared fixtures
Every API spec builds its own data against a throwaway schema (`DATABASE_URL` with a unique
`?schema=` per suite, `prisma migrate deploy`, dropped at teardown). Unless a case says otherwise:
- `LOC_A` = `{name:'Zone A', zone:'A'}`, `LOC_B` = `{name:'Zone B', zone:'B'}`, `LOC_C` = `{name:'Zone C', zone:'C'}`
- `ITEM_W` = `{sku:'SKU-T01', name:'Widget', unit:'ea', reorderAt:10}` with **0** opening stock
- Tokens: `clerkToken`, `managerToken`, `adminToken` obtained via `POST /api/auth/login`
- "auth headers" means `Authorization: Bearer <token>`

## API tests

### `GET /api/health`
- **Happy path**
  - `[API-001]` No `Authorization` header → `200`, body exactly `{status:'ok'}`.
- **Validation failures**
  - n/a — no inputs.
- **Auth failures**
  - `[API-002]` Endpoint is `@Public()`: a syntactically invalid bearer token (`Bearer garbage`) still → `200`, not `401`.
- **Idempotency / edge cases**
  - `[API-003]` 3 sequential calls → 3× identical `200` bodies; no DB connection required (passes with Postgres reachable or not).

### `GET /api/health/deep`
- **Happy path**
  - `[API-004]` No token, DB up → `200` with `{status:'ok', db:'ok'}` (`db` truthy/`'ok'`); asserts a real `SELECT 1` ran.
- **Validation failures**
  - n/a.
- **Auth failures**
  - `[API-005]` No token → `200` (public), never `401`.
- **Idempotency / edge cases**
  - `[API-006]` With `DATABASE_URL` pointed at a closed port, response is a non-`2xx` **or** `{status:'error', db:'down'}` — the process must not crash and `/api/health` must still return `200`.

### `POST /api/auth/signup`
- **Happy path**
  - `[API-007]` `{email:'new1@test.local', password:'Password123'}` → `2xx`; body contains `{accessToken:<non-empty string>, user:{id, email:'new1@test.local', role:'USER'}}`; **never** returns `passwordHash`.
  - `[API-008]` The returned `accessToken` is immediately usable: `GET /api/auth/me` with it → `200` and the same `id`/`email`.
- **Validation failures**
  - `[API-009]` `{email:'not-an-email', password:'Password123'}` → `400`.
  - `[API-010]` `{email:'ok@test.local', password:'short'}` (7 chars) → `400`; 8 chars → `2xx` (boundary).
  - `[API-011]` `{}` (both fields missing) → `400` listing both fields.
  - `[API-012]` `{email:'ok2@test.local', password:'Password123', role:'ADMIN'}` → `2xx` **and** created user's role is `USER` — `whitelist:true` must strip `role`; privilege escalation via mass-assignment is a FAIL.
- **Auth failures**
  - `[API-013]` Public route: succeeds with no token.
- **Idempotency / edge cases**
  - `[API-014]` Signing up an email that already exists → `409`; the original user's `passwordHash` is unchanged (old password still logs in).
  - `[API-015]` `{email:'NEW1@TEST.LOCAL'}` after `[API-007]` → `409` if emails are normalised, or `2xx` if case-sensitive — assert whichever the implementation chose is *consistent* with login lookup (same-case login must succeed).

### `POST /api/auth/login`
- **Happy path**
  - `[API-016]` Valid clerk credentials → `200` with `{accessToken, user:{id, email, role:'USER'}}`; no `passwordHash` in body.
  - `[API-017]` Valid manager credentials → `200` with `user.role === 'MANAGER'`; admin → `'ADMIN'`.
  - `[API-018]` Decoded JWT carries a user identifier and role claim and an `exp` ≈ 12h from `iat` (±5 min).
- **Validation failures**
  - `[API-019]` `{email:'nope'}` (missing password) → `400`.
  - `[API-020]` `{email:'not-an-email', password:'Password123'}` → `400`.
- **Auth failures**
  - `[API-021]` Correct email + wrong password → `401`; the message must not reveal which field was wrong.
  - `[API-022]` Unknown email → `401` (same body as `[API-021]`, so the endpoint is not a user-enumeration oracle).
- **Idempotency / edge cases**
  - `[API-023]` Two logins for the same user both return usable tokens; the first token still works after the second login (no server-side invalidation, per "no refresh token").

### `GET /api/auth/me`
- **Happy path**
  - `[API-024]` clerk token → `200` `{id, email, role:'USER'}`; no `passwordHash`.
- **Validation failures**
  - n/a.
- **Auth failures**
  - `[API-025]` No header → `401`.
  - `[API-026]` `Authorization: Bearer <malformed>` → `401`.
  - `[API-027]` Token signed with a wrong secret → `401`.
  - `[API-028]` Token with `exp` in the past → `401`.
- **Idempotency / edge cases**
  - `[API-029]` After the user row is deleted, the still-valid token → `401` (strategy must resolve the user, not trust the claim blindly).

### `GET /api/items`
- **Happy path**
  - `[API-030]` clerk token, 3 seeded items → `200` array of 3; each element has `id, sku, name, unit, reorderAt, qtyOnHand, isLow`.
  - `[API-031]` `ITEM_W` with `IN 30 → LOC_A` and `IN 12 → LOC_B` → its `qtyOnHand === 42` (sum across locations, not a denormalised column).
  - `[API-032]` Item with `reorderAt:10` and `qtyOnHand:10` → `isLow === true` (boundary, predicate is `<=`); `qtyOnHand:11` → `isLow === false`.
  - `[API-033]` Item with **no** `StockLevel` rows → `qtyOnHand === 0` and `isLow === true` (not omitted, not `null`).
- **Validation failures**
  - `[API-034]` `?q=widg` → returns `ITEM_W` only; `?q=WIDG` → same (case-insensitive); `?q=SKU-T01` → matches on sku; `?q=zzzz` → `200` with `[]`, never `404`.
  - `[API-035]` `?lowStock=true` → only items where `qtyOnHand <= reorderAt`; `?lowStock=false` / omitted → all items.
  - `[API-036]` `?q=widg&lowStock=true` → filters compose (AND), returning `ITEM_W` only while it is low.
- **Auth failures**
  - `[API-037]` No token → `401`.
- **Idempotency / edge cases**
  - `[API-038]` `GET` twice with no intervening mutation → byte-identical bodies (stable ordering).

### `GET /api/items/:id`
- **Happy path**
  - `[API-039]` clerk token, `ITEM_W` after `IN 30 → LOC_A` and `IN 12 → LOC_B` → `200` with `qtyOnHand:42` and `locations` = 2 entries `{locationId, name, zone, qty}` with qty 30 and 12.
  - `[API-040]` `sum(locations[].qty) === qtyOnHand` (the invariant the detail screen's total row renders).
- **Validation failures**
  - `[API-041]` Unknown but well-formed id → `404`.
  - `[API-042]` Malformed id (`'not-a-uuid'`) → `404` or `400`, never a `500`/Prisma stack leak.
- **Auth failures**
  - `[API-043]` No token → `401`.
- **Idempotency / edge cases**
  - `[API-044]` Item with zero stock rows → `200`, `qtyOnHand:0`, `locations: []`.
  - `[API-045]` A location whose stock was fully transferred out appears with `qty:0` or is absent — assert consistently and that it does not break `[API-040]`.

### `POST /api/items`
- **Happy path**
  - `[API-046]` manager token, `{sku:'SKU-T09', name:'Bolt', unit:'ea', reorderAt:5}` → `2xx` with `id` and echoed fields; a follow-up `GET /api/items` includes it with `qtyOnHand:0`.
  - `[API-047]` admin token, same shape → `2xx` (ADMIN satisfies the MANAGER requirement).
- **Validation failures**
  - `[API-048]` Missing `sku` → `400`; missing `name` → `400`; missing `unit` → `400`.
  - `[API-049]` `reorderAt:-1` → `400`; `reorderAt:'abc'` → `400`; `reorderAt:'7'` → `2xx` coerced to number `7` (`transform:true`).
  - `[API-050]` Duplicate `sku` → `400` with body message exactly `SKU already exists` (Prisma `P2002` mapped, **not** a `500`).
  - `[API-051]` Unknown field `{sku, name, unit, reorderAt, qtyOnHand: 999}` → the extra key is stripped (`whitelist`) and on-hand stays `0`.
- **Auth failures**
  - `[API-052]` No token → `401`.
  - `[API-053]` clerk token → `403` and no item row is created.
- **Idempotency / edge cases**
  - `[API-054]` Two concurrent creates with the same sku → exactly one `2xx`, the other `400 SKU already exists`; DB holds one row.

### `PATCH /api/items/:id`
- **Happy path**
  - `[API-055]` manager token, `{name:'Widget v2'}` → `2xx`; `sku`/`unit`/`reorderAt` unchanged (partial update).
  - `[API-056]` `{reorderAt: 50}` on an item with 42 on hand → subsequent `GET /api/items` shows `isLow:true` (threshold change re-derives, no stale flag).
- **Validation failures**
  - `[API-057]` `{reorderAt:-5}` → `400`.
  - `[API-058]` `{sku:'<sku of another item>'}` → `400 SKU already exists`.
  - `[API-059]` Unknown id → `404`.
- **Auth failures**
  - `[API-060]` No token → `401`; clerk token → `403` and the item is unmodified on re-read.
- **Idempotency / edge cases**
  - `[API-061]` Same PATCH applied twice → both `2xx`, identical resulting row; `qtyOnHand` never changes as a side effect of a metadata edit.

### `DELETE /api/items/:id`
- **Happy path**
  - `[API-062]` manager token, item with no movements and no stock levels → `2xx`; subsequent `GET /api/items/:id` → `404`.
- **Validation failures**
  - `[API-063]` Unknown id → `404`.
- **Auth failures**
  - `[API-064]` No token → `401`; clerk token → `403` and the item still exists.
- **Idempotency / edge cases**
  - `[API-065]` Item referenced by a `Movement` → `409` with an in-use message; the item, its movements and its stock levels all survive (audit integrity, `onDelete: Restrict`).
  - `[API-066]` Item with a `StockLevel` row (even `qty:0`) → `409`.
  - `[API-067]` Deleting the same id twice → first `2xx`, second `404` (not `500`).

### `GET /api/locations`
- **Happy path**
  - `[API-068]` clerk token → `200` array of `{id, name, zone}` for `LOC_A/B/C` (this feeds the movement wizard selects, so clerks must be able to read it).
- **Validation failures**
  - n/a.
- **Auth failures**
  - `[API-069]` No token → `401`.
- **Idempotency / edge cases**
  - `[API-070]` Empty table → `200 []`, never `404`.

### `POST /api/locations`
- **Happy path**
  - `[API-071]` manager token `{name:'Zone D', zone:'D'}` → `2xx` with `id`; admin token likewise `2xx`.
- **Validation failures**
  - `[API-072]` Missing `name` or missing `zone` → `400`.
  - `[API-073]` Duplicate `{name,zone}` pair → `400`/`409` with a clear message (composite `@@unique([name,zone])` mapped, not a `500`); `{name:'Zone A', zone:'B'}` (same name, different zone) → `2xx`.
- **Auth failures**
  - `[API-074]` No token → `401`; clerk token → `403` and no row created.
- **Idempotency / edge cases**
  - `[API-075]` Two concurrent creates of the same pair → one `2xx`, one conflict; one row in DB.

### `PATCH /api/locations/:id`
- **Happy path**
  - `[API-076]` manager token `{zone:'Z'}` → `2xx`; `name` unchanged; stock levels at that location keep their quantities.
- **Validation failures**
  - `[API-077]` Rename onto an existing `{name,zone}` pair → `400`/`409`; unknown id → `404`.
- **Auth failures**
  - `[API-078]` No token → `401`; clerk token → `403`.
- **Idempotency / edge cases**
  - `[API-079]` Renaming a location already referenced by movements → `2xx`, and `GET /api/movements` shows the **new** name (names are joined, not copied onto the movement row).

### `DELETE /api/locations/:id`
- **Happy path**
  - `[API-080]` manager token, location with no stock levels and no movements → `2xx`; gone from `GET /api/locations`.
- **Validation failures**
  - `[API-081]` Unknown id → `404`.
- **Auth failures**
  - `[API-082]` No token → `401`; clerk token → `403` and the location survives.
- **Idempotency / edge cases**
  - `[API-083]` Location with a `StockLevel` row → `409`; with a `Movement` referencing it as `fromLocId` **or** `toLocId` → `409`; in every case the location and referencing rows survive.

### `POST /api/movements`
- **Happy path**
  - `[API-084]` clerk token, `{type:'IN', itemId:ITEM_W, toLocId:LOC_A, qty:50}` → `2xx`; `GET /api/items/:id` → `qtyOnHand:50`, `locations:[{LOC_A, qty:50}]`.
  - `[API-085]` Then `{type:'OUT', itemId:ITEM_W, fromLocId:LOC_A, qty:20}` → `2xx`; on hand `30`.
  - `[API-086]` Then `{type:'TRANSFER', itemId:ITEM_W, fromLocId:LOC_A, toLocId:LOC_B, qty:10}` → `2xx`; `LOC_A === 20`, `LOC_B === 10`, `qtyOnHand` still `30` (transfer is total-preserving).
  - `[API-087]` `TRANSFER` into a location with **no** existing `StockLevel` row creates it with the transferred qty (open question in `tasks.md` — assert upsert-creates).
  - `[API-088]` The created `Movement` row records `userId` = the **JWT's** user, `note` when supplied, and a `createdAt`; a clerk cannot forge `userId` by putting one in the body (stripped by `whitelist`).
- **Validation failures**
  - `[API-089]` `IN` without `toLocId` → `400`; `IN` **with** `fromLocId` → `400` (forbidden, not silently ignored).
  - `[API-090]` `OUT` without `fromLocId` → `400`; `OUT` with `toLocId` → `400`.
  - `[API-091]` `TRANSFER` missing either loc → `400`; `TRANSFER` with `fromLocId === toLocId` → `400`.
  - `[API-092]` `qty:0` → `400`; `qty:-5` → `400`; `qty:1.5` → `400` (`@IsInt @Min(1)`); `qty:'10'` → `2xx` coerced to `10`.
  - `[API-093]` `type:'DESTROY'` → `400`; missing `type` → `400`; unknown `itemId` → `400`/`404`; unknown `toLocId` → `400`/`404` (never a raw FK `500`).
- **Auth failures**
  - `[API-094]` No token → `401` and no balance change.
- **Idempotency / edge cases**
  - `[API-095]` **Oversell guard:** with 5 on hand at `LOC_A`, `{type:'OUT', qty:10}` → `400` message `Insufficient stock`; re-read confirms `LOC_A` qty is **still 5**, `qtyOnHand` is 5, and **no** `Movement` row was written (transaction rolled back).
  - `[API-096]` `OUT` of exactly the on-hand qty (5 of 5) → `2xx`, balance `0`, no negative.
  - `[API-097]` `OUT` from a location where the item has no `StockLevel` row at all → `400 Insufficient stock` (not a crash, not a row created at `-qty`).
  - `[API-098]` `TRANSFER` of more than the source holds → `400 Insufficient stock`, and the **destination is not credited** (both legs roll back together).
  - `[API-099]` **Race:** 10 on hand, two concurrent `OUT 6` requests → exactly one `2xx` and one `400`; final balance `4`, never negative; exactly one `Movement` row (the conditional `updateMany` guard, not read-then-write).
  - `[API-100]` Two identical successful `IN 5` calls → balance `10` (movements are an append-only ledger, deliberately not idempotent).

### `GET /api/movements`
- **Happy path**
  - `[API-101]` manager token → `200` `{entries:[...], total:<n>, page:1}`; each entry has `user.email`, `item.sku`, `item.name`, `type`, `qty`, from/to location names (`null` where the type has no such leg), `createdAt`.
  - `[API-102]` Newest first (`createdAt` descending) across a set with known insertion order.
- **Validation failures**
  - `[API-103]` `?itemId=<ITEM_W>` → only `ITEM_W` rows; `total` reflects the **filtered** count, not the table count.
  - `[API-104]` `?type=TRANSFER` → only transfers; `?type=BOGUS` → `400`.
  - `[API-105]` `?from=`/`?to=` date range → only rows inside it; boundary rows at exactly `from` and exactly `to` are included; `from` later than `to` → `200` with `[]` or `400` (assert no `500`).
  - `[API-106]` `?itemId=…&type=OUT&from=…&to=…` combined → intersection only.
  - `[API-107]` `?page=2` with 60 rows → 10 entries, `total:60`; `?page=1` → exactly 50 (cap enforced); `?page=99` → `[]` with correct `total`; `?page=0` / `?page=-1` / `?page=abc` → `400` or clamped to page 1, never a negative `skip`.
- **Auth failures**
  - `[API-108]` No token → `401`.
  - `[API-109]` clerk token → `403` (clerks record movements but never read the audit log); admin token → `200`.
- **Idempotency / edge cases**
  - `[API-110]` No movements → `200 {entries:[], total:0}`.

### `GET /api/reports/low-stock`
- **Happy path**
  - `[API-111]` manager token → `200` rows of `{sku, name, onHand, reorderAt, deficit}`; admin → `200`.
  - `[API-112]` Item `reorderAt:10` with 12 on hand is **absent**; after `OUT 5` (7 on hand) it is **present** with `deficit:3`.
  - `[API-113]` Item with 40 on hand and `reorderAt:10` is absent.
  - `[API-114]` Boundary: `onHand === reorderAt` → **present** (predicate is `<=`, `deficit:0`).
  - `[API-115]` Item with no `StockLevel` rows → present with `onHand:0`, `deficit === reorderAt`.
  - `[API-116]` Ordering is by `deficit` descending across three items with deficits 8, 3, 0.
- **Validation failures**
  - n/a — no inputs.
- **Auth failures**
  - `[API-117]` No token → `401`; clerk token → `403`.
- **Idempotency / edge cases**
  - `[API-118]` Nothing low → `200 []`, never `404`.

### `GET /api/admin/settings`
- **Happy path**
  - `[API-119]` admin token → `200` listing every `postgresql` and `minio` credential key, each `{key, value:<masked>, configured:boolean}`.
  - `[API-120]` A key whose env value is absent **or** equals `PLACEHOLDER_CONFIGURE_IN_SETTINGS` → `configured:false`; a key set in `SystemSetting` → `configured:true`.
- **Validation failures**
  - n/a.
- **Auth failures**
  - `[API-121]` No token → `401`; clerk → `403`; **manager** (non-admin) → `403` (admin-only, stricter than manager).
- **Idempotency / edge cases**
  - `[API-122]` Secret values are masked — the raw `DATABASE_URL` password / MinIO secret key never appears verbatim in the response body.

### `PATCH /api/admin/settings`
- **Happy path**
  - `[API-123]` admin token with `{minio_access_key:'AKIA…', minio_secret_key:'s3cr3t'}` → `2xx`; a follow-up `GET` shows both `configured:true` and still masked.
  - `[API-124]` `resolveConfig(key)` precedence: with the env var set to a real value the env wins; with it unset or `PLACEHOLDER_CONFIGURE_IN_SETTINGS` the `SystemSetting` row is returned; with neither → `null`.
- **Validation failures**
  - `[API-125]` Malformed body (not key/value pairs, or an unknown key outside the `postgresql`/`minio` allow-list) → `400`, no `SystemSetting` row written.
- **Auth failures**
  - `[API-126]` No token → `401`; clerk → `403`; manager → `403`; and in each case no `SystemSetting` row is written.
- **Idempotency / edge cases**
  - `[API-127]` Same PATCH twice → both `2xx`, one row per key (upsert, not duplicate insert); `updatedAt` advances.
  - `[API-128]` PATCHing one key leaves other keys untouched.

### Retired scaffold surface (regression)
The stale `surface.json` routes must be gone once `/items` is the landing screen.
- `[API-129]` `GET /trpc/users.findAll` → `404` (router unregistered).
- `[API-130]` `GET /trpc/users.findById` → `404`.
- `[API-131]` `GET /health` (no `api` prefix) → `404`; the health check lives at `/api/health` only. If any deploy probe targets bare `/health`, this case must be reconciled with the platform **before** shipping — flag rather than silently keeping both.

## UI / journey tests

Playwright, against the built frontend with the API proxied at `/api`. Credentials from
`COLOSSUS_ACCOUNTS_JSON`. Every journey asserts no uncaught console errors and that the page
never renders the acceptance harness's reject signatures (`home-title">Users<`, `Loading...`
as a terminal state, `Failed to load users.`).

### Journey: `[JRN-001]` Anonymous landing and sign-in
- **Steps**: navigate to `/` with no token → observe redirect → type clerk email + password → submit.
- **Expected outcomes**: `/` redirects to `/login` (via `/items` guard bounce); the page text contains the literal **"StockRoom"** (the smoke oracle) and an email + password sign-in form; `<title>` is `StockRoom`; after submit the URL is `/items` and the item table renders; a JWT is present in `localStorage`.
- **Negative path**: wrong password → stays on `/login`, inline error shown, no token stored, no redirect.

### Journey: `[JRN-002]` Self-service signup
- **Steps**: `/login` → click the signup link → `/signup` → enter a fresh email + 8+ char password → submit.
- **Expected outcomes**: auto-login (token stored, no second sign-in prompt), URL becomes `/items`, the header user chip shows the new email, and manager-only nav links (`Audit log`, `Low stock`, `Admin settings`) are **absent** — signup creates a clerk.
- **Negative path**: password of 7 chars → inline validation, form not submitted; existing email → inline 409 "email already in use", still on `/signup`, no token stored.

### Journey: `[JRN-003]` Browse and search the catalogue (clerk)
- **Steps**: signed in as clerk at `/items` → type `widg` into search → toggle "low stock only" → clear both.
- **Expected outcomes**: table shows sku, name, unit, reorder threshold, qty on hand and a low-stock badge on qualifying rows; typing writes `?q=widg` into the URL; the toggle adds `?lowStock=true` while **preserving** `q` (`queryParamsHandling:'merge'`); the row set narrows accordingly; clearing removes the params.
- **Negative path**: `?q=zzzz` → an explicit empty state, not a spinner and not an error; with the API stubbed to `500`, an error state renders and the app does not white-screen.

### Journey: `[JRN-004]` Item detail with per-location breakdown
- **Steps**: from `/items` click `ITEM_W` (stocked 30 at Zone A, 12 at Zone B) → read header stats → switch to the `movements` tab → back to `locations`.
- **Expected outcomes**: header shows sku, unit, reorderAt and qty on hand `42`; the locations tab lists Zone A 30 and Zone B 12 with a total row reading **42** (visibly proving sum == on-hand); switching tabs sets `?tab=movements` / `?tab=locations` in the URL and browser Back returns to the previous tab.
- **Negative path**: `/items/<unknown-id>` → a not-found state, not a crash.

### Journey: `[JRN-005]` Record a movement (2-step wizard, clerk)
- **Steps**: clerk clicks "Record movement" → step 1 picks `ITEM_W` and type `IN` → Next → step 2 picks Zone A, qty 50, note → Submit → navigate to the item detail.
- **Expected outcomes**: step 1 → step 2 updates the URL to `?step=2&type=IN&itemId=…`; step 2 shows **only** the `To location` select (no `From`); after submit a success confirmation appears and the item's on-hand has increased by 50 on the detail screen.
- **Negative path**: submitting `OUT` for more than is on hand → the server's **"Insufficient stock"** renders inline, the form keeps its entered values (not cleared), and the item's balance is unchanged on re-read.

### Journey: `[JRN-006]` Wizard field rules per movement type
- **Steps**: at `/movements/new` cycle type through `IN`, `OUT`, `TRANSFER` and advance to step 2 each time.
- **Expected outcomes**: `IN` shows only `To`; `OUT` shows only `From`; `TRANSFER` shows both; qty and note always present.
- **Negative path**: `TRANSFER` with `From === To` → blocked with an inline message and no request sent; qty `0` or blank → inline validation, submit disabled or rejected.

### Journey: `[JRN-007]` Wizard deep link and browser history
- **Steps**: paste `/movements/new?step=2&type=TRANSFER&itemId=<ITEM_W>` into a fresh tab and hard-reload → press Back → press Forward.
- **Expected outcomes**: the reloaded page renders step 2 with `TRANSFER` selected, `ITEM_W` preselected and both location selects visible — no bounce to step 1; Back returns to step 1 with state intact; Forward returns to step 2.
- **Negative path**: `?step=2` with no `itemId` → falls back to step 1 rather than rendering a broken step 2.

### Journey: `[JRN-008]` Manager item CRUD
- **Steps**: manager at `/items` → "New item" → fill sku/name/unit/reorderAt → Save → open the item → Edit → change name → Save → attempt Delete.
- **Expected outcomes**: "New item" button is visible for managers; save navigates back to the list with the new row present (`qty on hand 0`); the edit persists after a hard reload; deleting an unreferenced item removes it from the list.
- **Negative path**: saving a duplicate sku → the message **"SKU already exists"** is surfaced **on the `sku` control** (not a generic toast); deleting an item that has movements → the `409` in-use message renders and the item is still listed.

### Journey: `[JRN-009]` Manager location CRUD
- **Steps**: manager → `/locations` → New → name + zone → Save → Edit zone → Save → Delete.
- **Expected outcomes**: list shows name and zone; create/edit persist across reload; new location immediately appears in the movement wizard's selects.
- **Negative path**: duplicate `{name, zone}` → inline conflict message; deleting a location holding stock or referenced by movements → the `409` delete-blocked message, location retained.

### Journey: `[JRN-010]` Audit log filter and pagination (manager)
- **Steps**: manager → `Audit log` → filter by item → add type `OUT` → set a date range → page to 2.
- **Expected outcomes**: table columns are user email, item, type, qty, from → to, timestamp; each filter writes to the URL (`?itemId=&type=&from=&to=&page=`) and narrows the rows; page 2 shows rows 51–100 and the URL carries `page=2`.
- **Negative path**: a filter combination matching nothing → an explicit empty state; changing a filter resets to page 1 rather than stranding the user on an out-of-range page.

### Journey: `[JRN-011]` Low-stock report and its call-to-action (manager)
- **Steps**: manager → `Low stock` → read the table → click a row's restock link.
- **Expected outcomes**: table shows sku, name, on hand, reorderAt and deficit, ordered by deficit descending; the report is **non-empty on first load** against seeded data; the row link navigates to `/movements/new?itemId=<that item>&type=IN` with both prefilled.
- **Negative path**: with nothing below threshold, an empty state renders (not a blank table).

### Journey: `[JRN-012]` Role-gated navigation and guard redirects
- **Steps**: as clerk, inspect the nav, then manually navigate to `/movements`, `/reports/low-stock`, `/items/new` and `/admin/settings`; repeat as manager and as admin.
- **Expected outcomes**: clerk sees only `Items`, `Locations`, `Record movement` and is redirected to `/items` from every manager/admin URL (no flash of protected content, no raw 403 page); manager sees `Audit log` and `Low stock` and can open them, but is redirected away from `/admin/settings`; admin sees and can open all of them.
- **Negative path**: a fully anonymous visit to `/movements` → `/login`, and after signing in the user lands on the originally requested URL (`returnUrl` preserved).

### Journey: `[JRN-013]` Admin settings and unconfigured-service banner
- **Steps**: admin → `/admin/settings` → read the banner → fill the MinIO credential form → Save → reload.
- **Expected outcomes**: one section per provisioned service (`postgresql`, `minio`) with a configured/unconfigured badge; the banner reads "The following need credentials to activate: …" and lists exactly the unconfigured services; after saving, MinIO flips to configured and the banner drops it; values stay masked after reload.
- **Negative path**: with every service configured, the banner is absent; a save that fails server-side surfaces an error and does not falsely flip the badge.

### Journey: `[JRN-014]` Session lifecycle — logout, restore, expiry
- **Steps**: sign in → hard-reload → click Logout → press Back → then re-sign-in and tamper `localStorage` with an expired token before loading `/items`.
- **Expected outcomes**: the session survives a reload (user chip still populated, no re-login); Logout clears the token and lands on `/login`; Back after logout does **not** restore an authenticated view; an expired/invalid token triggers the interceptor's 401 handling → session cleared and redirect to `/login`.
- **Negative path**: an API 401 mid-session (token revoked server-side) redirects to `/login` rather than leaving a half-rendered screen.

### Journey: `[JRN-015]` Route addressability — hard-reload every URL
- **Steps**: for each row of the route table — `/login`, `/signup`, `/items`, `/items?q=widg&lowStock=true`, `/items/new`, `/items/:id`, `/items/:id?tab=movements`, `/items/:id/edit`, `/locations`, `/locations/new`, `/locations/:id/edit`, `/movements/new?step=2&type=TRANSFER&itemId=…`, `/movements?itemId=…&page=2`, `/reports/low-stock`, `/admin/settings`, `/` — sign in with a sufficiently privileged role, hard-reload the URL and compare against the same view reached by clicking.
- **Expected outcomes**: every URL returns the app shell (nginx SPA fallback — no nginx 404) and renders the identical view **with filter/tab/step state applied**; `/` redirects to `/items`; an unknown path falls back to `/items`.
- **Negative path**: hard-reloading a manager URL as a clerk redirects to `/items` (guards run on direct load, not only on in-app navigation).

### Journey: `[JRN-016]` Deployment acceptance oracle
- **Steps**: from a clean volume run the composed stack; poll `/api/health/deep`; then load `/` as an anonymous visitor exactly as the acceptance harness does.
- **Expected outcomes**: `/api/health/deep` reports `db` ok; `/` serves the SPA with the `app-ready` test id present (per `.colossus-acceptance.json`) and page text containing "StockRoom"; migrations and the seed have run so `/items`, the audit log and the low-stock report are all non-empty after sign-in.
- **Negative path**: none of the reject signatures (`home-title">Users<`, a stuck `Loading...`, `Failed to load users.`) appear anywhere — the scaffold's home screen must be deleted, not merely unrouted.

## Data integrity tests

Assertions made directly against Postgres after the mutations above.
- `[DATA-001]` After any successful movement, `sum(StockLevel.qty) for an item` equals the `qtyOnHand` returned by `GET /api/items/:id` — on-hand is always derived, never denormalised onto `Item`.
- `[DATA-002]` `StockLevel.qty >= 0` for every row after every test in the suite; no code path can produce a negative balance.
- `[DATA-003]` A failed `OUT`/`TRANSFER` (`Insufficient stock`) writes **no** `Movement` row and leaves every `StockLevel.qty` byte-identical — the whole `$transaction` rolled back.
- `[DATA-004]` `TRANSFER` conserves total: `sum(qty)` for the item is identical before and after, while the two location rows changed by `-qty`/`+qty`.
- `[DATA-005]` Every `Movement` row satisfies its type's shape: `IN` → `fromLocId IS NULL AND toLocId IS NOT NULL`; `OUT` → `toLocId IS NULL AND fromLocId IS NOT NULL`; `TRANSFER` → both non-null and different.
- `[DATA-006]` Every `Movement.qty >= 1` and is an integer; no fractional or zero quantities persisted.
- `[DATA-007]` Every `Movement.userId` references a real `User` and matches the JWT subject of the request that created it — attribution is never null or client-supplied.
- `[DATA-008]` `@@unique([itemId, locationId])` on `StockLevel` holds: repeated `IN`s to the same item+location increment one row rather than inserting duplicates.
- `[DATA-009]` `@@unique` holds for `Item.sku`, `User.email` and `Location(name, zone)`; concurrent duplicate inserts leave exactly one row.
- `[DATA-010]` `onDelete: Restrict` holds at the DB level: a raw `DELETE` of an item or location referenced by `Movement` or `StockLevel` raises an FK error — the `409` is enforced by the schema, not only by service code.
- `[DATA-011]` `User.passwordHash` is a bcrypt hash (never plaintext), and no API response body anywhere in the suite contains a `passwordHash` key.
- `[DATA-012]` Seed idempotency: running the seed twice leaves the same row counts for `User`, `Location`, `Item`, `Movement` and the same `StockLevel.qty` values — opening balances are not doubled.
- `[DATA-013]` Post-seed preconditions the UI depends on: ≥1 item stocked in ≥2 locations, ≥1 item with `onHand <= reorderAt`, and ≥1 `Movement` row attributed to the manager account — so the detail breakdown, low-stock report and audit log are all non-empty on first load.

## Out of scope
- **The stale `surface.json` routes** (`/trpc/users.*`, bare `/health`) as *working* endpoints — the spec retires them. Only their absence is tested (`[API-129]`–`[API-131]`).
- **MinIO object-storage behaviour** — provisioned but the spec defines no attachments or item photos. Only credential configuration via `/admin/settings` is tested.
- **Role promotion / user administration** — the spec explicitly defers `PATCH /api/users/:id/role`; there is no in-app path from clerk to manager, so no test exists.
- **Token refresh and revocation** — the spec states a 12h HS256 JWT with no refresh token; `[API-023]` records that an old token stays valid by design rather than treating it as a defect.
- **Password reset, email verification, account lockout, rate limiting** — the spec is silent on all of them.
- **`ServeStaticModule` single-container packaging** — the spec's Step 14 describes it, but `colossus.yaml` and `tasks.md` fix the split backend + nginx topology. `[JRN-015]`/`[JRN-016]` test SPA fallback through nginx instead. **Reconcile before any Dockerfile rewrite.**
- **Hard-coded demo credentials** (`manager@demo` / `clerk@demo` / `Demo1234!`) — superseded by `COLOSSUS_ACCOUNTS_JSON`; asserting those literals would fail against the real deploy.
- **Concurrent `prisma migrate deploy` across replicas** — a known accepted risk for a single-tenant demo; not exercised.
- **Cross-browser, mobile viewport, accessibility audits, i18n, and visual regression** — the spec defines no requirements for them; journeys run in one desktop browser.
- **Load, soak and performance budgets** — no targets are specified. The only concurrency assertions are the correctness races in `[API-054]`, `[API-075]` and `[API-099]`.
