import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';

export async function createNotification({ recipient, title, message, type = 'system', link_id = null }) {
  try {
    return await Notification.create({
      recipient,
      title,
      message,
      type,
      link_id: link_id ? link_id.toString() : null,
      is_read: false,
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
}

export async function notifyUsers({ recipients, title, message, type = 'system', link_id = null }) {
  try {
    if (!recipients || recipients.length === 0) return [];
    const docs = recipients.map((r) => ({
      recipient: r,
      title,
      message,
      type,
      link_id: link_id ? link_id.toString() : null,
      is_read: false,
    }));
    return await Notification.insertMany(docs);
  } catch (error) {
    console.error('Failed to notify multiple users:', error);
    return [];
  }
}

export async function notifyAdmins({ title, message, type = 'system', link_id = null }) {
  try {
    const admins = await User.find({ role: 'admin' }).select('_id');
    const adminIds = admins.map((a) => a._id);
    return await notifyUsers({ recipients: adminIds, title, message, type, link_id });
  } catch (error) {
    console.error('Failed to notify admins:', error);
    return [];
  }
}
