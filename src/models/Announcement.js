import mongoose from 'mongoose';

const AnnouncementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    priority: {
      type: String,
      enum: ['normal', 'important', 'urgent'],
      default: 'normal',
    },
    // Who can see this: 'all' | 'cr' | 'teacher'
    audience: {
      type: String,
      enum: ['all', 'cr', 'teacher'],
      default: 'all',
    },
    posted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    posted_by_name: {
      type: String,
      required: true,
    },
    // Optional: pin to top
    is_pinned: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Sort pinned first, then newest
AnnouncementSchema.index({ is_pinned: -1, createdAt: -1 });

export const Announcement =
  mongoose.models.Announcement ||
  mongoose.model('Announcement', AnnouncementSchema);
