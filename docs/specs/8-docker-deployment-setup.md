# Spec: Docker Deployment and Unified Environment Configuration

## Goal
Enable containerized production deployment via Docker and Docker Compose behind an HTTPS reverse proxy (Nginx), with runtime configuration managed through a single root `.env` file with sensible defaults (port 6798, production mode), while preserving the workflow of running `pnpm dev` inside `backend/`.

## Current state
- The backend loads `.env` only from its immediate working directory (`process.cwd()/.env`). Running `pnpm dev` from `backend/` fails to find a root `.env`.
- Port defaults to 3000 if `PORT` is unset.
- `NODE_ENV` has no explicit fallback in the server code.
- Reverse proxy headers (`X-Forwarded-Proto`, `X-Forwarded-For`) are not trusted by Express.
- No `Dockerfile`, `.dockerignore`, or `docker-compose.yml` exists.
- Non-TypeScript migration files (`.sql`, `.json`) are not copied to `dist` during backend build.

## What needs to change
- **Targeted `.env` Loader:** Update the environment loader to check `./.env` (current working directory); if not found, check exactly one folder up (`../.env`). Never traverse beyond one parent directory.
- **Configurable Defaults:**
  - Default `PORT` to `6798` when unset.
  - Default `NODE_ENV` to `'production'` when unset.
  - Support `TRUST_PROXY` environment variable (`true` or `1` enables `app.set('trust proxy', 1)`).
- **Automated Migration Copying:** Ensure database migration files (`backend/src/db/migrations/`) are copied to `backend/dist/db/migrations/` as part of the backend build.
- **Docker Infrastructure:**
  - Add root multi-stage `Dockerfile` compiling frontend and backend, including migrations, and exposing port `6798`.
  - Add root `.dockerignore` excluding local dependencies, builds, `.git`, `.env`, and local SQLite files.
  - Add root `docker-compose.yml` binding port `6798` to `127.0.0.1`, reading root `.env`, and mounting `./data:/app/backend/data` for persistent storage.
  - Add root `.env.example` documenting all configuration options and their default values.

## Out of scope
- Configuring the external Nginx host or generating SSL certificates.
- Multi-instance horizontal scaling (SQLite requires a single writer instance).
- Modifying frontend Vue components or styling.

## Acceptance criteria
- Running `pnpm dev` inside `backend/` successfully loads the root `.env` (one folder up).
- The env loader only checks `./.env` and `../.env`.
- When `PORT` is unset, the backend starts and listens on port `6798`.
- Setting `TRUST_PROXY=true` enables Express proxy trust.
- Running `pnpm build` automatically copies migration files into `backend/dist/db/migrations/`.
- Building and running via Docker serves both the Vue SPA and backend API on port `6798`.
- Data written to the database persists across container restarts.
