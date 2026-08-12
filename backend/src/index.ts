import express from 'express';
import cors from 'cors';
import routes from './routes.js';
// Side-effect import: registers SIGINT/SIGTERM handlers in `store.ts`
// that flush any pending debounced writes before the process exits.
import './store.js';
import { errorHandler, notFoundHandler } from './middleware.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api', routes);

// Serve static files in production
app.use(express.static('../frontend/dist'));

// 404 handler for unmatched routes (anything that fell through above).
// Must be registered before the error handler so the error handler
// doesn't intercept the 404 response.
app.use(notFoundHandler);

// Final error-handling middleware. Express recognizes this by the
// 4-argument signature and routes any error from earlier middleware /
// handlers here.
app.use(errorHandler);

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
