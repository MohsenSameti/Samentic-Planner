import { Router, type Router as ExpressRouter } from 'express';
import { DbStore, store as defaultStore } from './db/store.js';
import { ApiError } from './middleware.js';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
  CreatePropertySchema,
  UpdatePropertySchema,
  CreatePropertyValueSchema,
  DayNoteSchema,
  WeekNoteSchema,
  SettingsSchema,
  IdParamSchema,
} from './validation.js';

/**
 * Build an Express router backed by the given `DbStore` instance.
 *
 * Exists as a factory so tests can mount the API against a per-test
 * in-memory (or temp-file) store. Production callers (see `index.ts`)
 * wire it up against the singleton via the default export below.
 */
export function createRouter(store: DbStore): ExpressRouter {
  // Explicit `ExpressRouter` annotation works around a TS2742 portability
  // warning that arises from the inferred type referencing internal
  // `@types/express-serve-static-core` paths.
  const router: ExpressRouter = Router();

  // All route handlers follow the same pattern:
  //   1. Parse and validate inputs (Zod throws on failure → caught by the
  //      route-level `try`/`catch` and forwarded to the error middleware).
  //   2. Run the store operation.
  //   3. Send the result, or throw an `ApiError` for known failure modes
  //      (e.g. not found, conflict) so the response shape stays consistent.
  //
  // Express 4 doesn't auto-catch async errors thrown from route handlers,
  // so each handler wraps its body in `try`/`catch` and forwards to
  // `next(err)`. The error middleware then turns the error into a JSON
  // response with the appropriate status code.

  // --- Projects ----------------------------------------------------------

  router.get('/projects', (_req, res) => {
    res.json(store.getProjects());
  });

  router.post('/projects', (req, res, next) => {
    try {
      const data = CreateProjectSchema.parse(req.body);
      const now = Date.now();
      const project = store.addProject({
        ...data,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      });
      res.status(201).json(project);
    } catch (err) {
      next(err);
    }
  });

  router.put('/projects/:id', (req, res, next) => {
    try {
      const { id } = IdParamSchema.parse(req.params);
      const updates = UpdateProjectSchema.parse(req.body);
      const project = store.updateProject(id, updates);
      if (!project) {
        throw new ApiError(`Project not found: ${id}`, 404);
      }
      res.json(project);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/projects/:id', (req, res, next) => {
    try {
      const { id } = IdParamSchema.parse(req.params);
      const removed = store.deleteProject(id);
      if (!removed) {
        throw new ApiError(`Project not found: ${id}`, 404);
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // --- Tasks -------------------------------------------------------------

  router.get('/tasks', (_req, res) => {
    res.json(store.getTasks());
  });

  router.post('/tasks', (req, res, next) => {
    try {
      const data = CreateTaskSchema.parse(req.body);
      const now = Date.now();
      const task = store.addTask({
        ...data,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      });
      res.status(201).json(task);
    } catch (err) {
      next(err);
    }
  });

  router.put('/tasks/:id', (req, res, next) => {
    try {
      const { id } = IdParamSchema.parse(req.params);
      const updates = UpdateTaskSchema.parse(req.body);
      const task = store.updateTask(id, updates);
      if (!task) {
        throw new ApiError(`Task not found: ${id}`, 404);
      }
      res.json(task);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/tasks/:id', (req, res, next) => {
    try {
      const { id } = IdParamSchema.parse(req.params);
      const removed = store.deleteTask(id);
      if (!removed) {
        throw new ApiError(`Task not found: ${id}`, 404);
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // --- Properties --------------------------------------------------------

  router.get('/properties', (_req, res) => {
    res.json(store.getProperties());
  });

  router.post('/properties', (req, res, next) => {
    try {
      const data = CreatePropertySchema.parse(req.body);
      const now = Date.now();
      const prop = store.addProperty({
        ...data,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      });
      res.status(201).json(prop);
    } catch (err) {
      next(err);
    }
  });

  router.put('/properties/:id', (req, res, next) => {
    try {
      const { id } = IdParamSchema.parse(req.params);
      const updates = UpdatePropertySchema.parse(req.body);
      const prop = store.updateProperty(id, updates);
      if (!prop) {
        throw new ApiError(`Property not found: ${id}`, 404);
      }
      res.json(prop);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/properties/:id', (req, res, next) => {
    try {
      const { id } = IdParamSchema.parse(req.params);
      const removed = store.deleteProperty(id);
      if (!removed) {
        throw new ApiError(`Property not found: ${id}`, 404);
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // --- Property Values ---------------------------------------------------

  router.get('/property-values', (_req, res) => {
    res.json(store.getPropertyValues());
  });

  router.post('/property-values', (req, res, next) => {
    try {
      const data = CreatePropertyValueSchema.parse(req.body);
      // Validate the referenced property exists; otherwise the upsert
      // creates an orphan `PropertyValue` pointing at nothing.
      const propertyExists = store
        .getProperties()
        .some((p) => p.id === data.propertyId);
      if (!propertyExists) {
        throw new ApiError(`Property not found: ${data.propertyId}`, 404);
      }
      const pv = store.setPropertyValue({
        ...data,
        id: generateId(),
      });
      res.status(201).json(pv);
    } catch (err) {
      next(err);
    }
  });

  // --- Day Notes ---------------------------------------------------------

  router.get('/day-notes', (_req, res) => {
    res.json(store.getDayNotes());
  });

  router.post('/day-notes', (req, res, next) => {
    try {
      const note = DayNoteSchema.parse(req.body);
      const saved = store.setDayNote(note);
      res.json(saved);
    } catch (err) {
      next(err);
    }
  });

  // --- Week Notes --------------------------------------------------------

  router.get('/week-notes', (_req, res) => {
    res.json(store.getWeekNotes());
  });

  router.post('/week-notes', (req, res, next) => {
    try {
      const note = WeekNoteSchema.parse(req.body);
      const saved = store.setWeekNote(note);
      res.json(saved);
    } catch (err) {
      next(err);
    }
  });

  // --- Full State --------------------------------------------------------

  router.get('/state', (_req, res) => {
    res.json(store.getState());
  });

  // --- Settings ----------------------------------------------------------

  router.get('/settings', (_req, res) => {
    res.json(store.getSettings());
  });

  router.put('/settings', (req, res, next) => {
    try {
      const parsed = SettingsSchema.parse(req.body);
      // `SettingsSchema` constrains `weekStart` to 0..6 at runtime,
      // but Zod still infers a plain `number`. Narrow to `WeekStartDay`
      // so the store receives a type-correct value.
      const settings = parsed as { weekStart: 0 | 1 | 2 | 3 | 4 | 5 | 6; calendar: 'gregorian' | 'jalali' };
      const saved = store.updateSettings(settings);
      res.json(saved);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

// --- Helpers -----------------------------------------------------------

/**
 * Lightweight unique-enough ID for client-generated entities. Same shape
 * the frontend uses in `App.vue`'s `generateId()` so the two stay in
 * sync if one changes. A proper UUID library would be overkill for a
 * single-user planner.
 */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/**
 * Default export wires the router up to the module-singleton store
 * (the same instance `db/store.ts` registers SIGINT/SIGTERM handlers
 * on). Tests should use `createRouter(testStore)` instead.
 */
export default createRouter(defaultStore);
