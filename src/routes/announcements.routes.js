import express from 'express';
import { Announcement } from '../models/Announcement.js';
import { User } from '../models/User.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { notifyUsers } from '../utils/notifications.js';

const router = express.Router();

// GET /api/announcements
router.get('/', authenticateToken, async (req, res) => {
  try {
    let audienceFilter = {};
    if (req.user.role !== 'admin') {
      audienceFilter = { audience: { $in: ['all', req.user.role] } };
    }

    const announcements = await Announcement.find(audienceFilter)
      .sort({ is_pinned: -1, createdAt: -1 })
      .limit(50)
      .lean();

    return res.json({ success: true, announcements });
  } catch (error) {
    console.error('Fetch announcements error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch announcements.' });
  }
});

// POST /api/announcements (Admin only)
router.post('/', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { title, content, priority = 'normal', audience = 'all', is_pinned = false } = req.body;

    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ success: false, message: 'Title and content are required.' });
    }

    const announcement = await Announcement.create({
      title: title.trim(),
      content: content.trim(),
      priority,
      audience,
      is_pinned,
      posted_by: req.user.id,
      posted_by_name: req.user.name,
    });

    try {
      const userFilter = { _id: { $ne: req.user.id } };
      if (audience === 'cr') userFilter.role = 'cr';
      else if (audience === 'teacher') userFilter.role = 'teacher';

      const targetUsers = await User.find(userFilter).select('_id');
      const recipientIds = targetUsers.map((u) => u._id);

      const priorityPrefix = priority === 'urgent' ? '🚨 [URGENT] ' : priority === 'important' ? '⚠️ [IMPORTANT] ' : '📢 ';
      await notifyUsers({
        recipients: recipientIds,
        title: `${priorityPrefix}${title.trim()}`,
        message: content.trim().length > 100 ? `${content.trim().slice(0, 100)}...` : content.trim(),
        type: 'announcement',
        link_id: announcement._id,
      });
    } catch (notifErr) {
      console.error('Announcement notification dispatch error:', notifErr);
    }

    return res.status(201).json({ success: true, message: 'Announcement posted successfully.', announcement });
  } catch (error) {
    console.error('Post announcement error:', error);
    return res.status(500).json({ success: false, message: 'Failed to post announcement.' });
  }
});

// DELETE /api/announcements/:id (Admin only)
router.delete('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const deleted = await Announcement.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }
    return res.json({ success: true, message: 'Announcement deleted.' });
  } catch (error) {
    console.error('Delete announcement error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete announcement.' });
  }
});

// PATCH /api/announcements/:id (Admin only: toggle pin)
router.patch('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { is_pinned } = req.body;
    const updated = await Announcement.findByIdAndUpdate(
      req.params.id,
      { is_pinned },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }
    return res.json({ success: true, announcement: updated });
  } catch (error) {
    console.error('Patch announcement error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update announcement.' });
  }
});

export default router;
