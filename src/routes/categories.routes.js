import express from 'express';
import { Category } from '../models/Category.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    let query = {};
    if (req.user.role !== 'admin') {
      query = {
        $or: [{ allowed_role: req.user.role }, { allowed_role: 'both' }]
      };
    }

    const categories = await Category.find(query).sort({ _id: 1 });

    const formatted = categories.map(cat => ({
      id: cat._id.toString(),
      _id: cat._id.toString(),
      name: cat.name,
      allowed_role: cat.allowed_role,
    }));

    return res.json({
      success: true,
      categories: formatted,
    });
  } catch (error) {
    console.error('Fetch categories error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch categories.' });
  }
});

export default router;
