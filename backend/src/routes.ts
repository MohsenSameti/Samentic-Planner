import { Router } from 'express';
import { store } from './store.js';

const router = Router();

// Projects
router.get('/projects', (req, res) => {
  res.json(store.getProjects());
});

router.post('/projects', (req, res) => {
  const project = store.addProject(req.body);
  res.json(project);
});

router.put('/projects/:id', (req, res) => {
  const project = store.updateProject(req.params.id, req.body);
  res.json(project);
});

router.delete('/projects/:id', (req, res) => {
  store.deleteProject(req.params.id);
  res.json({ success: true });
});

// Tasks
router.get('/tasks', (req, res) => {
  res.json(store.getTasks());
});

router.post('/tasks', (req, res) => {
  const task = store.addTask(req.body);
  res.json(task);
});

router.put('/tasks/:id', (req, res) => {
  const task = store.updateTask(req.params.id, req.body);
  res.json(task);
});

router.delete('/tasks/:id', (req, res) => {
  store.deleteTask(req.params.id);
  res.json({ success: true });
});

// Properties
router.get('/properties', (req, res) => {
  res.json(store.getProperties());
});

router.post('/properties', (req, res) => {
  const prop = store.addProperty(req.body);
  res.json(prop);
});

router.put('/properties/:id', (req, res) => {
  const prop = store.updateProperty(req.params.id, req.body);
  res.json(prop);
});

router.delete('/properties/:id', (req, res) => {
  store.deleteProperty(req.params.id);
  res.json({ success: true });
});

// Property Values
router.get('/property-values', (req, res) => {
  res.json(store.getPropertyValues());
});

router.post('/property-values', (req, res) => {
  const pv = store.setPropertyValue(req.body);
  res.json(pv);
});

// Day Notes
router.get('/day-notes', (req, res) => {
  res.json(store.getDayNotes());
});

router.post('/day-notes', (req, res) => {
  const note = store.setDayNote(req.body);
  res.json(note);
});

// Week Notes
router.get('/week-notes', (req, res) => {
  res.json(store.getWeekNotes());
});

router.post('/week-notes', (req, res) => {
  const note = store.setWeekNote(req.body);
  res.json(note);
});

// Full State
router.get('/state', (req, res) => {
  res.json(store.getState());
});

export default router;
