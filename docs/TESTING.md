# Testing

pnpm workspace, two Vitest 4 suites: `backend`, `frontend`.
496 tests / 31 files (backend 141/5, frontend 355/26). Work test-first.

## Commands (repo root)

- `pnpm test` — both suites
- `pnpm test:backend` / `pnpm test:frontend`
- `pnpm test:watch` — frontend watch
- `pnpm test:coverage` — v8, report-only, no thresholds

Single file/test:

```bash
cd frontend && pnpm vitest run src/components/WeekView/TaskCard.spec.ts
cd backend  && pnpm vitest run src/store.test.ts -t 'cascades deletes'
```

## Layout

Tests sit next to their source. No `tests/` tree.

- `*.test.ts` — pure functions, composables, api client, routes
- `*.spec.ts` — Vue components (`@vue/test-utils` `mount`)
- `*.integration.spec.ts` — multi-component wiring

Globs: backend `src/**/*.test.ts`, frontend `src/**/*.{test,spec}.ts`.

## Backend (`backend/vitest.config.ts`)

- `environment: 'node'`, `isolate: true` (avoids singleton `store` bleed)
- Fresh DB per test: `new DbStore({ dbPath: ':memory:' })` (runs
  migrations + seed); `store.shutdown()` in `afterEach`
- HTTP: build a real Express app (cors, json, `createRouter(store)`,
  `notFoundHandler`, `errorHandler`) and drive it with `supertest`
  in-process. See `src/api.test.ts`.
- Auth (`src/routes/auth.test.ts`): adds `express-session` +
  `SQLiteSessionStore`; use a `supertest` **agent** so the session
  cookie persists across requests.
- Use/extend the typed fixture builders (`makeProject`, `makeTask`).

## Frontend (`frontend/vitest.config.ts`)

- `happy-dom`; `@vitejs/plugin-vue`
- `globals: false` — import `describe/it/expect/vi` in every file
- `env.TZ = 'UTC'` — required; `useWeekNavigation` uses
  `toISOString()`, so non-UTC hosts shift dates. Don't remove.
- `src/test/setup.ts`: `beforeEach` resets `apiError`/`isLoading` from
  `api.ts`; `afterEach` does `restoreAllMocks` + `unstubAllGlobals` +
  `useRealTimers`.

Patterns:

- Components: drive via user/emitted events; never assert private
  internals. Treat module-level fixtures as immutable (spread to vary).
- Composables: `vi.mock('../api.js', () => ({ api: { getTasks: vi.fn(), ... } }))`,
  assert on returned refs and mutations.
- Api client: stub `globalThis.fetch`, return real `Response` objects
  (success / HTTP error / network failure / retries).
- Integration: wire real components in a `defineComponent` + `h`
  harness using App.vue's props/events. Use when the bug is in the
  wiring (see `docs/plans/7841-useauth-reactive-return.md`).

## TDD

1. Red — write the test, run it, confirm it fails for the intended
   reason (observable behaviour, not implementation).
2. Green — smallest code that passes.
3. Refactor — suite green after each step. Cycle per behaviour.

Rules:

- No production code without a failing test demanding it.
- Bugfix starts with a regression test at the level the bug lives;
  mocking the broken seam proves nothing.
- Never weaken/skip/delete assertions to get green. If a test is
  genuinely wrong, say so and why before changing it.
- Tests are strictly typed; no implicit `any`.
- New component ⇒ new `*.spec.ts` beside it.

Before "done": `pnpm test` and `pnpm build` pass (verified output), no
`.skip`/`.only`, UI checked at mobile/tablet/desktop.
