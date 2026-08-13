import { z } from 'zod';

// --- Shared primitives -------------------------------------------------
// Lifted into named constants so the regex is parsed once at module load
// and the patterns are documented in one place.

const HEX_COLOR = /^#([0-9A-F]{3}){1,2}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// --- Projects ----------------------------------------------------------

export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  color: z.string().regex(HEX_COLOR, 'Must be a hex color (e.g. #E74C3C)'),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});

export const CreateProjectSchema = ProjectSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateProjectSchema = ProjectSchema.partial();

// --- Tasks -------------------------------------------------------------

export const TaskSchema = z.object({
  id: z.string().min(1),
  projectId: z.string(),
  title: z.string().min(1).max(500),
  description: z.string(),
  date: z.string().regex(ISO_DATE, 'Must be ISO date (YYYY-MM-DD)'),
  status: z.enum(['active', 'completed', 'cancelled']),
  notes: z.string(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});

export const CreateTaskSchema = TaskSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateTaskSchema = TaskSchema.partial();

// --- Properties --------------------------------------------------------

export const PropertySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  unit: z.string().max(50),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});

export const CreatePropertySchema = PropertySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdatePropertySchema = PropertySchema.partial();

// --- Property Values ---------------------------------------------------

export const PropertyValueSchema = z.object({
  id: z.string().min(1),
  propertyId: z.string().min(1),
  date: z.string().regex(ISO_DATE, 'Must be ISO date (YYYY-MM-DD)'),
  value: z.number(),
});

export const CreatePropertyValueSchema = PropertyValueSchema.omit({
  id: true,
});

// --- Day / Week Notes --------------------------------------------------

export const DayNoteSchema = z.object({
  date: z.string().regex(ISO_DATE, 'Must be ISO date (YYYY-MM-DD)'),
  note: z.string(),
});

export const WeekNoteSchema = z.object({
  weekStart: z.string().regex(ISO_DATE, 'Must be ISO date (YYYY-MM-DD)'),
  note: z.string(),
});

// --- Settings ----------------------------------------------------------

/**
 * Numeric day-of-week, 0 (Sunday) .. 6 (Saturday). Matches
 * `Date#getDay()`. Stored as a number rather than a name so the
 * client doesn't need to maintain a parallel string→number table.
 */
export const WeekStartDaySchema = z
  .number()
  .int()
  .min(0)
  .max(6);

/**
 * Supported calendar systems. Mirrored on the frontend in
 * `types/index.ts` so the wire format stays in lockstep. Adding a
 * new calendar (e.g. Hijri) is a one-line change here plus the
 * same literal-union update on the frontend.
 */
export const CalendarSchema = z.enum(['gregorian', 'jalali']);

/**
 * Settings body for PUT /settings. All fields are required so a
 * partial update can't accidentally leave the client/server out of
 * sync on defaults.
 */
export const SettingsSchema = z.object({
  weekStart: WeekStartDaySchema,
  calendar: CalendarSchema,
});

// --- ID param ----------------------------------------------------------
// Used for any `/:id` style route. Centralized so the length check isn't
// repeated in every handler.

export const IdParamSchema = z.object({
  id: z.string().min(1),
});
