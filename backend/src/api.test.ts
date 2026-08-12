/**
 * End-to-end tests for the Express API surface.
 *
 * Each test mounts a fresh `JsonStore` (pointed at a temp file) and a
 * fresh Express app wired up with the production middleware stack
 * (CORS, JSON parsing, error handler). `supertest` drives HTTP
 * requests in-process — no real socket, no port binding.
 *
 * The temp store is shut down in `afterEach` so pending debounced
 * writes never leak past a test boundary.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import express from 'express'
import cors from 'cors'
import request from 'supertest'
import { JsonStore } from './store.js'
import { createRouter } from './routes.js'
import { errorHandler, notFoundHandler } from './middleware.js'

/**
 * Build a fresh `JsonStore` and an Express app wired to it. Caller
 * owns the returned values; `cleanupApp` releases them.
 */
function buildApp(): { app: express.Express; store: JsonStore; tmpDir: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), 'planner-api-tests-'))
  const storePath = join(tmpDir, 'data.json')
  const store = new JsonStore({ storePath })

  const app = express()
  app.use(cors())
  app.use(express.json())
  app.use('/api', createRouter(store))
  app.use(notFoundHandler)
  app.use(errorHandler)

  return { app, store, tmpDir }
}

function cleanupApp(store: JsonStore, tmpDir: string): void {
  store.shutdown()
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}

describe('API: projects', () => {
  let app: express.Express
  let store: JsonStore
  let tmpDir: string

  beforeEach(() => {
    ;({ app, store, tmpDir } = buildApp())
  })

  afterEach(() => {
    cleanupApp(store, tmpDir)
  })

  it('GET /api/projects returns the seeded default project', async () => {
    const res = await request(app).get('/api/projects')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].name).toBe('General')
  })

  it('POST /api/projects creates a project', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'Work', color: '#E74C3C' })
    expect(res.status).toBe(201)
    expect(res.body.id).toBeTruthy()
    expect(res.body.name).toBe('Work')
    expect(res.body.color).toBe('#E74C3C')
  })

  it('POST /api/projects rejects an invalid color with 400', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'X', color: 'red' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Validation failed')
  })

  it('POST /api/projects rejects an empty name with 400', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: '', color: '#000' })
    expect(res.status).toBe(400)
  })

  it('PUT /api/projects/:id updates an existing project', async () => {
    const created = await request(app)
      .post('/api/projects')
      .send({ name: 'Old', color: '#000000' })
    const updated = await request(app)
      .put(`/api/projects/${created.body.id}`)
      .send({ name: 'New' })
    expect(updated.status).toBe(200)
    expect(updated.body.name).toBe('New')
    expect(updated.body.color).toBe('#000000')
  })

  it('PUT /api/projects/:id returns 404 for missing id', async () => {
    const res = await request(app)
      .put('/api/projects/missing')
      .send({ name: 'X' })
    expect(res.status).toBe(404)
  })

  it('DELETE /api/projects/:id returns 404 for missing id', async () => {
    const res = await request(app).delete('/api/projects/missing')
    expect(res.status).toBe(404)
  })

  it('DELETE /api/projects/:id removes an existing project', async () => {
    const created = await request(app)
      .post('/api/projects')
      .send({ name: 'Tmp', color: '#FFF' })
    const del = await request(app).delete(`/api/projects/${created.body.id}`)
    expect(del.status).toBe(200)
    expect(del.body.success).toBe(true)
  })
})

describe('API: tasks', () => {
  let app: express.Express
  let store: JsonStore
  let tmpDir: string

  beforeEach(() => {
    ;({ app, store, tmpDir } = buildApp())
  })

  afterEach(() => {
    cleanupApp(store, tmpDir)
  })

  const validTask = {
    projectId: 'default',
    title: 'Test',
    description: 'Desc',
    date: '2024-01-01',
    status: 'active' as const,
    notes: '',
  }

  it('POST /api/tasks creates a task', async () => {
    const res = await request(app).post('/api/tasks').send(validTask)
    expect(res.status).toBe(201)
    expect(res.body.title).toBe('Test')
    expect(res.body.id).toBeTruthy()
  })

  it('POST /api/tasks rejects an invalid status', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ ...validTask, status: 'invalid' })
    expect(res.status).toBe(400)
  })

  it('POST /api/tasks rejects a non-ISO date', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ ...validTask, date: '01-01-2024' })
    expect(res.status).toBe(400)
  })

  it('PUT /api/tasks/:id updates a task', async () => {
    const created = await request(app).post('/api/tasks').send(validTask)
    const updated = await request(app)
      .put(`/api/tasks/${created.body.id}`)
      .send({ status: 'completed' })
    expect(updated.status).toBe(200)
    expect(updated.body.status).toBe('completed')
  })

  it('PUT /api/tasks/:id returns 404 for missing id', async () => {
    const res = await request(app)
      .put('/api/tasks/missing')
      .send({ status: 'completed' })
    expect(res.status).toBe(404)
  })

  it('DELETE /api/tasks/:id removes a task', async () => {
    const created = await request(app).post('/api/tasks').send(validTask)
    const del = await request(app).delete(`/api/tasks/${created.body.id}`)
    expect(del.status).toBe(200)
    const list = await request(app).get('/api/tasks')
    expect(list.body).toHaveLength(0)
  })

  it('GET /api/tasks returns all tasks', async () => {
    await request(app).post('/api/tasks').send(validTask)
    await request(app)
      .post('/api/tasks')
      .send({ ...validTask, title: 'B' })
    const res = await request(app).get('/api/tasks')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
  })
})

describe('API: properties', () => {
  let app: express.Express
  let store: JsonStore
  let tmpDir: string

  beforeEach(() => {
    ;({ app, store, tmpDir } = buildApp())
  })

  afterEach(() => {
    cleanupApp(store, tmpDir)
  })

  it('POST /api/properties creates a property', async () => {
    const res = await request(app)
      .post('/api/properties')
      .send({ name: 'Hours', unit: 'h' })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Hours')
  })

  it('PUT /api/properties/:id updates a property', async () => {
    const created = await request(app)
      .post('/api/properties')
      .send({ name: 'H', unit: 'h' })
    const updated = await request(app)
      .put(`/api/properties/${created.body.id}`)
      .send({ unit: 'hrs' })
    expect(updated.body.unit).toBe('hrs')
  })

  it('DELETE /api/properties/:id returns 404 for missing id', async () => {
    const res = await request(app).delete('/api/properties/missing')
    expect(res.status).toBe(404)
  })
})

describe('API: property values', () => {
  let app: express.Express
  let store: JsonStore
  let tmpDir: string
  let propertyId: string

  beforeEach(async () => {
    ;({ app, store, tmpDir } = buildApp())
    const created = await request(app)
      .post('/api/properties')
      .send({ name: 'Hours', unit: 'h' })
    propertyId = created.body.id
  })

  afterEach(() => {
    cleanupApp(store, tmpDir)
  })

  it('POST /api/property-values upserts a value', async () => {
    const res = await request(app)
      .post('/api/property-values')
      .send({ propertyId, date: '2024-01-01', value: 5 })
    expect(res.status).toBe(201)
    expect(res.body.value).toBe(5)
  })

  it('POST /api/property-values returns 404 for unknown propertyId', async () => {
    const res = await request(app)
      .post('/api/property-values')
      .send({ propertyId: 'missing', date: '2024-01-01', value: 5 })
    expect(res.status).toBe(404)
  })

  it('POST /api/property-values with value=0 clears the row', async () => {
    await request(app)
      .post('/api/property-values')
      .send({ propertyId, date: '2024-01-01', value: 5 })
    await request(app)
      .post('/api/property-values')
      .send({ propertyId, date: '2024-01-01', value: 0 })
    const list = await request(app).get('/api/property-values')
    expect(list.body).toHaveLength(0)
  })

  it('POST /api/property-values updates an existing row in place', async () => {
    await request(app)
      .post('/api/property-values')
      .send({ propertyId, date: '2024-01-01', value: 5 })
    await request(app)
      .post('/api/property-values')
      .send({ propertyId, date: '2024-01-01', value: 7 })
    const list = await request(app).get('/api/property-values')
    expect(list.body).toHaveLength(1)
    expect(list.body[0].value).toBe(7)
  })
})

describe('API: notes', () => {
  let app: express.Express
  let store: JsonStore
  let tmpDir: string

  beforeEach(() => {
    ;({ app, store, tmpDir } = buildApp())
  })

  afterEach(() => {
    cleanupApp(store, tmpDir)
  })

  it('POST /api/day-notes upserts a day note', async () => {
    const res = await request(app)
      .post('/api/day-notes')
      .send({ date: '2024-01-01', note: 'hi' })
    expect(res.status).toBe(200)
    expect(res.body.note).toBe('hi')
  })

  it('POST /api/day-notes with empty note removes the row', async () => {
    await request(app)
      .post('/api/day-notes')
      .send({ date: '2024-01-01', note: 'hi' })
    await request(app)
      .post('/api/day-notes')
      .send({ date: '2024-01-01', note: '' })
    const list = await request(app).get('/api/day-notes')
    expect(list.body).toHaveLength(0)
  })

  it('POST /api/week-notes upserts a week note', async () => {
    const res = await request(app)
      .post('/api/week-notes')
      .send({ weekStart: '2024-01-01', note: 'plan' })
    expect(res.status).toBe(200)
    expect(res.body.note).toBe('plan')
  })

  it('POST /api/week-notes rejects malformed dates', async () => {
    const res = await request(app)
      .post('/api/week-notes')
      .send({ weekStart: 'not-a-date', note: 'plan' })
    expect(res.status).toBe(400)
  })
})

describe('API: full state', () => {
  let app: express.Express
  let store: JsonStore
  let tmpDir: string

  beforeEach(() => {
    ;({ app, store, tmpDir } = buildApp())
  })

  afterEach(() => {
    cleanupApp(store, tmpDir)
  })

  it('GET /api/state returns all six collections', async () => {
    const res = await request(app).get('/api/state')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('projects')
    expect(res.body).toHaveProperty('tasks')
    expect(res.body).toHaveProperty('properties')
    expect(res.body).toHaveProperty('propertyValues')
    expect(res.body).toHaveProperty('dayNotes')
    expect(res.body).toHaveProperty('weekNotes')
  })

  it('GET /api/state reflects subsequent writes', async () => {
    await request(app)
      .post('/api/projects')
      .send({ name: 'X', color: '#FFF' })
    const res = await request(app).get('/api/state')
    // The default 'General' plus the one we just added.
    expect(res.body.projects).toHaveLength(2)
  })
})

describe('API: error handling', () => {
  let app: express.Express
  let store: JsonStore
  let tmpDir: string

  beforeEach(() => {
    ;({ app, store, tmpDir } = buildApp())
  })

  afterEach(() => {
    cleanupApp(store, tmpDir)
  })

  it('returns 400 for malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Content-Type', 'application/json')
      .send('{ not json')
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid JSON in request body')
  })

  it('returns 404 for an unknown API path', async () => {
    const res = await request(app).get('/api/unknown')
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Not Found')
  })
})
