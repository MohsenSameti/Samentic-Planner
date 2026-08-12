- Strict typing required. No implicit `any`.
- If `any` seems necessary, stop and ask the user first, stating why no other type works.
- Prefer `unknown` + narrowing over `any`.

## Testing

- `pnpm test` runs the full backend + frontend suite (241 tests across 17 files).
- `pnpm test:backend` / `pnpm test:frontend` run a single workspace.
- `pnpm test:watch` runs the frontend suite in watch mode.
- `pnpm test:coverage` reports coverage (no threshold gates — report-only).
- Backend: Vitest + `supertest` for the Express API. `JsonStore` is
  constructed per-test with a temp file via `new JsonStore({ storePath })`.
- Frontend: Vitest + `@vue/test-utils` + `happy-dom`. Component
  tests live next to the source as `*.spec.ts`; pure-function and
  composable tests live as `*.test.ts`.
- The test environment pins `TZ=UTC` so date arithmetic in
  `useWeekNavigation` is deterministic regardless of the host clock.
- When adding a new component, write a `*.spec.ts` next to it that
  drives it through events rather than asserting on private state.
