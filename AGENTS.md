- Strict typing required. No implicit `any`.
- If `any` seems necessary, stop and ask the user first, stating why no other type works.
- Prefer `unknown` + narrowing over `any`.

- this project is responsive. so every ui change needs to consider mobile, tablet, desktop, etc.
- whenever you are asked to improve something or add/implement sth. you are to create a plan using create-plan then proceed.

## Testing

- `pnpm test` runs the full backend + frontend suite (375 tests across 25 files).
- `pnpm test:backend` / `pnpm test:frontend` run a single workspace.
- `pnpm test:watch` runs the frontend suite in watch mode.
- `pnpm test:coverage` reports coverage (no threshold gates — report-only).
- Backend: Vitest + `supertest` for the Express API. `DbStore` is
  constructed per-test with an in-memory SQLite DB via
  `new DbStore({ dbPath: ':memory:' })`.
- Frontend: Vitest + `@vue/test-utils` + `happy-dom`. Component
  tests live next to the source as `*.spec.ts`; pure-function and
  composable tests live as `*.test.ts`.
- The test environment pins `TZ=UTC` so date arithmetic in
  `useWeekNavigation` is deterministic regardless of the host clock.
- When adding a new component, write a `*.spec.ts` next to it that
  drives it through events rather than asserting on private state.
