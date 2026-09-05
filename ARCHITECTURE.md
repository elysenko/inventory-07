# Architecture

## Requested stack
- `enterprise` (Angular 19 + NestJS + tRPC + Prisma + PostgreSQL) — **newly scaffolded**

## Layout
- `frontend/` — Angular 19 standalone-component SPA (project name `frontend` in `angular.json`), tRPC client wiring in `src/app/app.config.ts` / `src/app/trpc-client.types.ts`.
- `backend/` — NestJS API. `src/trpc/` wires `nestjs-trpc`; `src/users/` is the seed feature (router + service); `src/health/` exposes a Terminus health check; `src/prisma/` wraps `PrismaClient`.
- `.pipeline/surface.json` — generated contract of routes, components, and `data-testid`s for the test_spec/Playwright agents. Regenerate (append, don't remove entries) whenever routes/components/testids are added.
- `.colossus-acceptance.json` — post-deploy render-gate contract. `ready_testid` is `app-ready` (already on `app-root`, do not remove). `expect_text` is intentionally empty — the coder must fill it in with real substrings from the finished front page. `reject_signatures` currently detect the untouched template stub (the "Users" list demo).
- `colossus.yaml` — build manifest read by deploy agents (Angular build output `dist/frontend/browser`, Nest backend on port 3001, combined via nginx SPA fallback).

## Plan-specific work still to do (StockRoom)
The scope in the technical plan (JWT auth, role guards, Items/Locations/Movements/Reports modules, Angular routes/components for those features) has **not** been implemented yet — only the bare `template-enterprise` scaffold (health check + users demo) exists so far. The coder agent should build the plan's features on top of this scaffold:
- Extend `backend/prisma/schema.prisma` with the plan's models (`User`, `Item`, `Location`, `StockLevel`, `Movement`) and run a Prisma migration.
- Add the `auth`, `items`, `locations`, `movements`, `reports` Nest modules under `backend/src/`.
- Add the Angular feature routes/components under `frontend/src/app/features/` and `frontend/src/app/core/` per the plan's route table.
- Update `.pipeline/surface.json` and `.colossus-acceptance.json` (`expect_text`) as real routes/components/testids land — do not leave them at template defaults.
- Remove or repurpose the demo `users` router/component once real features replace it.

## Next steps for the developer
1. Set real values in `backend/.env` (`DATABASE_URL`, `JWT_SECRET`, etc.) — no `.env.template` shipped with this template; create one from `backend/src/main.ts`/Prisma config as needed.
2. `npm install` at the repo root (npm workspaces over `frontend`/`backend`).
3. `npx prisma migrate dev` inside `backend/` once the schema is extended.
4. `docker-compose up` for local Postgres + app, or run `frontend`/`backend` dev servers separately.
5. Keep `frontend/package.json` dependencies verbatim unless a new dependency is genuinely required by the plan.

## Template source
- `enterprise` copied from `scaffold-templates/template-enterprise/`.
