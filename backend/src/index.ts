import express from 'express';
import cors from 'cors';
import routes from './routes.js';
// Side-effect import: registers SIGINT/SIGTERM handlers in `store.ts`
// that flush any pending debounced writes before the process exits.
import './store.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api', routes);

// Serve static files in production
app.use(express.static('../frontend/dist'));

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Log shutdown so it's visible in development. The store's own signal
// handler (registered in store.ts) flushes pending writes before the
// process exits; we just want a friendly message in the logs.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    console.log(`\n[server] Received ${signal}, shutting down...`);
    server.close(() => process.exit(0));
  });
}
