import express from 'express';
import cors from 'cors';
import routes from './routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api', routes);

// Serve static files in production
app.use(express.static('../frontend/dist'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
