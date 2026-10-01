import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

router.get('/', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';

  return res.json({
    status: 'ok',
    service: 'ResolveX Express API Backend',
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

export default router;
