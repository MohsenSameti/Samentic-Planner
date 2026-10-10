# Testing

Two Vitest 4 suites: `backend`, `frontend`, plus a separate headless Playwright suite.
Work test-first. `pnpm test` explicitly runs both Vitest suites; browser tests run separately.

## Commands (repo root)

- `pnpm test` — both suites
- `pnpm test:backend` / `pnpm test:frontend`
- `pnpm test:watch` — frontend watch
- `pnpm test:coverage` — v8, report-only, no thresholds
- `pnpm test:e2e` — build, strict browser-test type check, then headless Chromium at three viewport sizes
- `pnpm test:e2e:system` — same suite using Chromium found on PATH (POSIX shell; trusted local testing only)
- `pnpm test:e2e:typecheck` — type-check browser tests/configuration without launching a browser
- `pnpm test:e2e:report` — open the last Playwright HTML report

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
- `*.e2e.ts` — real-browser user flows, colocated with the app/component they exercise

Vitest globs: backend `src/**/*.test.ts`, frontend `src/**/*.{test,spec}.ts`.
Playwright discovers only `frontend/src/**/*.e2e.ts`; it does not run Vitest files.

## Backend (`backend/vitest.config.ts`)

- `environment: 'node'`, `isolate: true` (avoids singleton `store` bleed),
  `testTimeout: 10_000` (a ceiling for slow hardware, not a target)
- Fresh DB per test: `new DbStore({ dbPath: ':memory:' })` (runs
  migrations + seed); `store.shutdown()` in `afterEach`
- HTTP: build a real Express app (cors, json, `createRouter(store)`,
  `notFoundHandler`, `errorHandler`) and drive it with `supertest`
  in-process. See `src/api.test.ts`.
- Auth (`src/routes/auth.test.ts`): adds `express-session` +
  `SQLiteSessionStore`; use a `supertest` **agent** so the session
  cookie persists across requests.
- Bcrypt cost is 4 under tests (`defaultSaltRounds` in `src/routes/auth.ts`),
  12 otherwise. Don't assert on a real 12-round hash in a test — it takes
  seconds. Test the resolution rule directly, and assert wiring through the
  `$2b$NN$` prefix of a hash made at a low cost.
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

## Browser tests (Playwright)

**Android devices must use `pnpm test:e2e:system` instead of `pnpm test:e2e`, with locally installed Chromium on PATH.** See [Optional external browser](#optional-external-browser) below. The bundled-browser installation instructions that follow are for supported desktop/CI hosts.

Install the repository's dependencies (root, backend, and frontend) as usual, then install Chromium:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

On CI hosts requiring browser system libraries, use `pnpm exec playwright install --with-deps chromium`.
The default uses Playwright's bundled Chromium. No browser paths or local launch workarounds are required on supported hosts.

`pnpm test:e2e` always builds first so the tests cannot silently exercise stale application code.
For focused iteration after a build:

```bash
pnpm exec playwright test --project=desktop
pnpm exec playwright test frontend/src/components/LoginPage.e2e.ts
pnpm exec playwright test --grep 'navigation and dialogs'
pnpm exec playwright test --workers=2
```

Configuration: `playwright.config.ts`. Strict type checking: `tsconfig.e2e.json`.
Projects: mobile (390×844, touch/mobile emulation), tablet (820×1180, touch), desktop (1440×900).
All use Chromium, UTC, and an English locale. This checks responsive Chromium behavior, not native mobile browsers or other engines.
One worker and no retries by default; no focused tests are allowed.

### Isolation and fixtures

Import `test` and `expect` from `frontend/src/test/e2e.ts`, not directly from Playwright.
Each test starts the existing built backend entry point on a dynamically allocated port, with its own in-memory SQLite database and session store.
The backend serves the built frontend directly; there is no API mocking or development-server reuse.
A new browser context isolates cookies/local storage per test. Shutdown runs in fixture teardown, with a bounded force-stop fallback.
Developer databases and credentials are never used. Tests can run alone, in any order, or with multiple workers.

The server uses development mode with the real password-hashing cost (the production entry point refuses test mode).
Setup has dedicated UI coverage; other app flows can initialize authentication through the real API.
App-flow tests freeze the browser's Date to avoid midnight/week rollover while leaving timers and network requests real.
Use accessible locators and web-first assertions; CSS selectors are reserved for containers with no semantic locator.
Wait for mutation responses before reload when asserting optimistic updates are persisted. Do not use arbitrary sleeps.

Coverage includes setup validation, incorrect/correct passwords, session persistence/logout, protected API access,
project/task creation, task editing/completion after reload, sidebar/week/day navigation, and dialog fit/dismissal at all three sizes.
The existing Escape shortcut exits day view as well as closing an open task modal; modal-only Escape dismissal is tested from week view.

### Optional external browser

A locally managed Chromium can be selected through `E2E_BROWSER_EXECUTABLE_PATH`.
Optional `E2E_BROWSER_ARGS` must be a JSON array of strings; invalid values fail configuration loading.
Supply these through the invoking shell or CI environment, not hardcoded project paths or platform checks.
A custom Chromium version is not guaranteed compatible with Playwright; prefer the bundled browser on supported hosts.

For a one-command alternative in a POSIX shell:

```bash
pnpm test:e2e:system
```

This shortcut finds `chromium-browser` first, falling back to `chromium` on PATH.
If neither is found, it exits with a clear error before building or launching tests.
It sets `PLAYWRIGHT_BROWSERS_PATH=0`, the discovered `E2E_BROWSER_EXECUTABLE_PATH`, and
`E2E_BROWSER_ARGS` to `["--no-sandbox","--disable-dev-shm-usage"]` for the delegated
`test:e2e` command only. No prior exports are needed; the parent shell is not modified.
The shortcut propagates failures and leaves the standard `pnpm test:e2e` command unchanged.
**Security:** this disables Chromium's sandbox. Use it only for trusted local application tests,
not browsing untrusted sites. The shortcut requires a POSIX-compatible shell, not a particular OS.

### Reports and failures

The HTML report is in `playwright-report/`; per-test output is in `test-results/`.
Failed tests retain a trace, screenshot, and backend log. These generated directories are ignored by Git.
Use `pnpm test:e2e:report` to inspect failures. Treat artifacts as potentially sensitive (they may contain session data).
Run `pnpm test`, `pnpm test:e2e`, and `pnpm build` before considering browser-test changes complete.

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
