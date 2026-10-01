import express from 'express';
import { Notification } from '../models/Notification.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/notifications
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipient: req.user.id })
        .sort({ created_at: -1 })
        .limit(30)
        .lean(),
      Notification.countDocuments({ recipient: req.user.id, is_read: false }),
    ]);

    const formatted = notifications.map((n) => ({
      id: n._id.toString(),
      _id: n._id.toString(),
      title: n.title,
      message: n.message,
      type: n.type,
      link_id: n.link_id,
      is_read: n.is_read,
      created_at: n.created_at,
    }));

    return res.json({ success: true, unreadCount, notifications: formatted });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
});

// PATCH /api/notifications (Mark all as read)
router.patch('/', authenticateToken, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, is_read: false },
      { $set: { is_read: true } }
    );
    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    console.error('Mark all read error:', error);
    return res.status(500).json({ success: false, message: 'Failed to mark notifications as read.' });
  }
});

// DELETE /api/notifications (Clear read)
router.delete('/', authenticateToken, async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user.id, is_read: true });
    return res.json({ success: true, message: 'Cleared all read notifications.' });
  } catch (error) {
    console.error('Clear notifications error:', error);
    return res.status(500).json({ success: false, message: 'Failed to clear notifications.' });
  }
});

// PATCH /api/notifications/:id (Mark single as read)
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const notif = await Notification.findOne({ _id: req.params.id, recipient: req.user.id });
    if (!notif) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }
    notif.is_read = true;
    await notif.save();
    return res.json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    console.error('Mark read error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update notification.' });
  }
});

// DELETE /api/notifications/:id (Delete single)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const notif = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user.id });
    if (!notif) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }
    return res.json({ success: true, message: 'Notification deleted.' });
  } catch (error) {
    console.error('Delete notification error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete notification.' });
  }
});

export default router;
