import mongoose from 'mongoose';

const StatusLogSchema = new mongoose.Schema({
  old_status: {
    type: String,
    default: null,
  },
  new_status: {
    type: String,
    required: true,
  },
  changed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  changed_by_name: {
    type: String,
    default: '',
  },
  changed_by_role: {
    type: String,
    default: '',
  },
  note: {
    type: String,
    default: '',
  },
  changed_at: {
    type: Date,
    default: Date.now,
  },
});

const CommentSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  author_name: {
    type: String,
    required: true,
  },
  author_role: {
    type: String,
    enum: ['cr', 'teacher', 'admin'],
    required: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

const GrievanceSchema = new mongoose.Schema(
  {
    submitted_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    year: {
      type: Number,
      enum: [1, 2, 3, 4],
      default: 1,
    },
    branch: {
      type: String,
      enum: ['AIML', 'AI'],
      default: 'AIML',
    },
    section: {
      type: String,
      default: 'A',
    },
    description: {
      type: String,
      required: false,
      default: '',
      trim: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    attachment_url: {
      type: String,
      default: null,
    },
    resolution_photo_url: {
      type: String,
      default: null,
    },
    assigned_department: {
      type: String,
      enum: ['infra', 'it_infra', 'ac_incharge', 'ac', null],
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'resolved', 'rejected'],
      default: 'pending',
    },
    admin_notes: {
      type: String,
      default: null,
    },
    resolved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolved_at: {
      type: Date,
      default: null,
    },
    status_logs: [StatusLogSchema],
    comments: [CommentSchema],
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

export const Grievance = mongoose.models.Grievance || mongoose.model('Grievance', GrievanceSchema);
