import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password_hash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['cr', 'teacher', 'admin', 'infra_head', 'it_infra_head', 'ac_incharge'],
      required: true,
    },
    department: {
      type: String,
      default: 'AIML',
    },
    branch: {
      type: String,
      enum: ['AIML', 'AI'],
      default: 'AIML',
    },
    year: {
      type: Number,
      enum: [1, 2, 3, 4],
      default: null,
    },
    section: {
      type: String,
      default: null,
      trim: true,
    },
    semester: {
      type: Number,
      default: null,
    },
    roll_no: {
      type: String,
      default: null,
      trim: true,
    },
    mobile: {
      type: String,
      default: null,
      trim: true,
    },
    gender: {
      type: String,
      default: null,
    },
    avatar_url: {
      type: String,
      default: null,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
);

export const User = mongoose.models.User || mongoose.model('User', UserSchema);
