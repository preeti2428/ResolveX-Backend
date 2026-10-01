import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    allowed_role: {
      type: String,
      enum: ['cr', 'teacher', 'both'],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);
