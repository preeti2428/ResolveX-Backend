import express from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/users/profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password_hash').lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || 'AIML',
        branch: user.branch || 'AIML',
        year: user.year || null,
        section: user.section || null,
        mobile: user.mobile || '',
        phone: user.mobile || '',
        avatar_url: user.avatar_url || null,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error('Fetch profile error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch user profile.' });
  }
});

// PATCH /api/users/profile
router.patch('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, phone, mobile, currentPassword, newPassword, avatar_url } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Current password is required to set a new password.' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
      }
      const isMatch = bcrypt.compareSync(currentPassword, user.password_hash);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Incorrect current password.' });
      }
      const salt = bcrypt.genSaltSync(10);
      user.password_hash = bcrypt.hashSync(newPassword, salt);
    }

    if (name && name.trim()) user.name = name.trim();
    if (phone !== undefined) user.mobile = phone.trim();
    if (mobile !== undefined) user.mobile = mobile.trim();
    if (avatar_url !== undefined) user.avatar_url = avatar_url;

    await user.save();

    return res.json({
      success: true,
      message: newPassword ? 'Password updated and profile saved successfully.' : 'Profile updated successfully.',
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || 'AIML',
        branch: user.branch || 'AIML',
        year: user.year || null,
        section: user.section || null,
        phone: user.mobile || '',
        avatar_url: user.avatar_url || null,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to update profile.' });
  }
});

// GET /api/users (Admin only)
router.get('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { role, is_active, search, year, branch } = req.query;
    const filter = {};

    if (role && role !== 'all') filter.role = role;
    if (year && year !== 'all') filter.year = Number(year);
    if (branch && branch !== 'all') filter.branch = branch;
    if (is_active !== null && is_active !== undefined && is_active !== 'all') {
      filter.is_active = is_active === '1' || is_active === 'true';
    }
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: regex }, { email: regex }, { section: regex }];
    }

    const users = await User.find(filter)
      .select('-password_hash')
      .sort({ role: 1, created_at: -1 });

    const formatted = users.map((u) => ({
      id: u._id.toString(),
      _id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      department: u.department,
      branch: u.branch || 'AIML',
      year: u.year,
      semester: u.semester,
      section: u.section,
      roll_no: u.roll_no,
      mobile: u.mobile,
      gender: u.gender,
      is_active: u.is_active,
      created_at: u.created_at,
    }));

    return res.json({ success: true, count: formatted.length, users: formatted });
  } catch (error) {
    console.error('List users error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list users.' });
  }
});

// PATCH /api/users/:id/toggle-active (Admin only)
router.patch('/:id/toggle-active', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot deactivate an administrator account.' });
    }

    user.is_active = !user.is_active;
    await user.save();

    return res.json({
      success: true,
      message: `User '${user.name}' has been ${user.is_active ? 'activated' : 'deactivated'}.`,
      is_active: user.is_active ? 1 : 0,
    });
  } catch (error) {
    console.error('Toggle active error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update user status.' });
  }
});

export default router;
