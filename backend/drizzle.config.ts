/**
 * drizzle-kit configuration.
 *
 * Reads `DATABASE_URL` from `process.env` (same env var the app
 * uses at runtime) so the schema URL and the app URL are never
 * out of sync. The migration folder matches the one expected
 * by `src/db/migrate.ts`.
 *
 * Run `pnpm db:generate` to produce a new migration after
 * editing `src/db/schema.ts`.
 */
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  // `drizzle-kit` accepts either a `dbCredentials.url` string
  // or a full object. The app-side path resolver (in
  // `src/db/client.ts`) does its own normalisation, so we
  // mirror the same logic here for `generate`.
  dbCredentials: {
    url: process.env.DATABASE_URL ?? './data/planner.db',
  },
  verbose: true,
  strict: true,
});