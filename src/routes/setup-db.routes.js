import express from 'express';
import { seedDefaultData } from '../config/db.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    await seedDefaultData();
    return res.json({ success: true, message: 'Database seeded with default demo data successfully.' });
  } catch (error) {
    console.error('Setup DB error:', error);
    return res.status(500).json({ success: false, message: 'Failed to seed database.', detail: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    await seedDefaultData();
    return res.json({ success: true, message: 'Database verified and seeded successfully.' });
  } catch (error) {
    console.error('Setup DB error:', error);
    return res.status(500).json({ success: false, message: 'Failed to seed database.', detail: error.message });
  }
});

export default router;
