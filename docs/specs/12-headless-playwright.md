# Spec: Headless Playwright

## Goal
Add portable, headless browser coverage for the planner's core user flows and responsive layouts.

## Current state
The workspace has backend and frontend Vitest suites but no Playwright suite. The Express server supports an externally selected database and serves the built frontend. Authentication includes initial setup and password sign-in.

## What needs to change
- Add a dedicated Playwright command, strictly typed configuration, and Chromium projects for mobile, tablet, and desktop viewport sizes.
- Run against the real application with an isolated disposable database, without touching developer data or reusing a running development server.
- Add colocated browser tests for initial setup, sign-in failures and success, session persistence/logout, project/task workflows, and responsive navigation.
- Support optional generic external-browser overrides while retaining standard Playwright browser defaults.
- Add an opt-in pnpm test:e2e:system shortcut for POSIX shells. Discover chromium-browser or chromium on PATH, fail clearly if neither exists, and apply the verified browser-cache and launch settings before invoking the existing test:e2e command. Document that it disables the browser sandbox and is for trusted local testing.
- Document portable installation and execution in docs/TESTING.md and ignore generated reports/artifacts.

## Out of scope
Hardcoded host paths, platform detection, platform-specific setup instructions, browser patches, new product features, and exhaustive browser-engine coverage. The generic system-browser shortcut is opt-in; the default browser command and configuration remain unchanged.

## Acceptance criteria
- Browser tests pass headlessly using a real backend and isolated test data.
- Mobile, tablet, and desktop projects exercise relevant core flows without arbitrary sleeps.
- Playwright tests are separate from Vitest discovery and are type-checked.
- Existing pnpm test and pnpm build pass.
- No production data is modified and no hardcoded host paths or platform detection are committed.
- The system-browser shortcut runs without prior shell exports, handles both executable names, fails before building if neither is found, and propagates test failures. The standard pnpm test:e2e command remains unchanged.
