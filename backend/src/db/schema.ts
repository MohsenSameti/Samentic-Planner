/**
 * Drizzle schema for the planner SQLite database.
 *
 * Maps the domain types in `../types.ts` to SQLite tables. Column
 * names use `snake_case` in the database (Drizzle's preferred wire
 * format) while JS accessors stay `camelCase` via the `name`
 * override. Primary keys are client-generated strings (the same
 * `generateId()` shape the frontend uses) so the API stays
 * symmetric with the JSON-store era.
 *
 * Tables mirror the collections previously held in
 * `backend/data.json`:
 *
 *   - `projects`           — top-level grouping for tasks.
 *   - `tasks`              — dated items belonging to a project.
 *   - `properties`         — user-defined metrics (e.g. "Hours").
 *   - `property_values`    — daily values for a property, upserted
 *                            on `(property_id, date)`.
 *   - `day_notes`          — free-form notes keyed by ISO date.
 *   - `week_notes`         — free-form notes keyed by week start.
 *   - `settings`           — singleton user settings row, always
 *                            `id = 1`. The single-row design is
 *                            enforced by the store layer (there is
 *                            no other way to address a settings
 *                            row).
 *
 * All `createdAt` / `updatedAt` columns store **milliseconds**
 * since epoch (a JS `Date.now()` value). The schema never
 * applies a SQL-side default for these columns — every write
 * path in `db/store.ts` supplies the value explicitly.
 */
import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** Project — top-level grouping for tasks. */
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  color: text('color').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/** Task — dated item belonging to a project. `projectId` may be
 *  the empty string when the project has been deleted (matches
 *  the pre-refactor JSON-store behavior of "detaching" tasks
 *  rather than cascading-deleting them). */
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  date: text('date').notNull(),
  status: text('status', { enum: ['active', 'completed', 'cancelled'] }).notNull(),
  notes: text('notes').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/** Property — user-defined metric (e.g. "Hours", "Pages"). */
export const properties = sqliteTable('properties', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  unit: text('unit').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/** PropertyValue — a single daily value for a property. Composite
 *  unique index on `(property_id, date)` enforces the upsert key
 *  the store layer relies on (one value per property per day). */
export const propertyValues = sqliteTable(
  'property_values',
  {
    id: text('id').primaryKey(),
    propertyId: text('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    value: real('value').notNull(),
  },
  (table) => ({
    propertyDateIdx: uniqueIndex('property_values_property_id_date_idx').on(
      table.propertyId,
      table.date
    ),
  })
);

/** DayNote — free-form note for an ISO date. The date is the PK. */
export const dayNotes = sqliteTable('day_notes', {
  date: text('date').primaryKey(),
  note: text('note').notNull(),
});

/** WeekNote — free-form note for a week (keyed by its start date). */
export const weekNotes = sqliteTable('week_notes', {
  weekStart: text('week_start').primaryKey(),
  note: text('note').notNull(),
});

/** Settings — singleton user settings row. Always addressed by
 *  `id = 1`; the store layer enforces this invariant. */
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey().default(1),
  weekStart: integer('week_start').notNull(),
  calendar: text('calendar', { enum: ['gregorian', 'jalali'] }).notNull(),
  /** Sentinel column updated on every settings write. Lets us
   *  detect drift between the on-disk row and the in-process
   *  store without a separate `version` table. Not exposed via
   *  the API.
   *
   *  Stored as **milliseconds** since epoch to match every
   *  other `createdAt` / `updatedAt` column in the schema.
   *  The previous SQL-side `unixepoch()` default (seconds)
   *  was inconsistent with the rest of the schema; all writes
   *  now supply `Date.now()` explicitly. */
  updatedAt: integer('updated_at').notNull(),
});

/** Convenience types so consumers don't have to write out the
 *  Drizzle-inferred row shapes. `typeof table.$inferSelect` and
 *  `typeof table.$inferInsert` give the read and write row
 *  shapes respectively. */
export type ProjectRow = typeof projects.$inferSelect;
export type ProjectInsert = typeof projects.$inferInsert;

export type TaskRow = typeof tasks.$inferSelect;
export type TaskInsert = typeof tasks.$inferInsert;

export type PropertyRow = typeof properties.$inferSelect;
export type PropertyInsert = typeof properties.$inferInsert;

export type PropertyValueRow = typeof propertyValues.$inferSelect;
export type PropertyValueInsert = typeof propertyValues.$inferInsert;

export type DayNoteRow = typeof dayNotes.$inferSelect;
export type DayNoteInsert = typeof dayNotes.$inferInsert;

export type WeekNoteRow = typeof weekNotes.$inferSelect;
export type WeekNoteInsert = typeof weekNotes.$inferInsert;

export type SettingsRow = typeof settings.$inferSelect;
export type SettingsInsert = typeof settings.$inferInsert;