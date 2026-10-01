import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';

import authRoutes from './routes/auth.routes.js';
import categoriesRoutes from './routes/categories.routes.js';
import grievancesRoutes from './routes/grievances.routes.js';
import usersRoutes from './routes/users.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import announcementsRoutes from './routes/announcements.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import healthRoutes from './routes/health.routes.js';
import setupDbRoutes from './routes/setup-db.routes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logger in dev
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${req.method}] ${req.url}`);
    next();
  });
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/grievances', grievancesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/setup-db', setupDbRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'ResolveX API Backend',
    version: '1.0.0',
    documentation: '/api/health',
    status: 'online',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.url} not found.` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error occurred.',
  });
});

// Initialize DB and start listening
async function startServer() {
  try {
    await connectDB();
    console.log('✅ Connected to MongoDB.');
  } catch (dbErr) {
    console.warn('⚠️ Warning: MongoDB connection failed on boot:', dbErr.message);
    console.warn('Backend will continue to run and retry connections on requests.');
  }

  app.listen(PORT, () => {
    console.log(`🚀 ResolveX Backend running at http://localhost:${PORT}`);
    console.log(`📊 Health check available at http://localhost:${PORT}/api/health`);
  });
}

startServer();
