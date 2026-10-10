import mongoose from 'mongoose';

// Positions and sizes are stored as fractions of the image (0..1) so the same
// layout renders identically at any resolution.
const fieldSchema = new mongoose.Schema(
  {
    key: { type: String, enum: ['name', 'date'], required: true },
    label: { type: String, default: '' },
    x: { type: Number, default: 0.5, min: 0, max: 1 }, // anchor point, fraction of width
    y: { type: Number, default: 0.5, min: 0, max: 1 }, // vertical centre, fraction of height
    fontFamily: { type: String, default: 'Playfair Display' },
    fontSize: { type: Number, default: 0.04, min: 0.005, max: 0.3 }, // fraction of image width
    color: { type: String, default: '#1a1a1a' },
    align: { type: String, enum: ['left', 'center', 'right'], default: 'center' },
    bold: { type: Boolean, default: false },
    maxWidth: { type: Number, default: 0.6, min: 0.05, max: 1 } // text shrinks to fit this width
  },
  { _id: false }
);

const templateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    imageFile: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    fields: { type: [fieldSchema], default: [] }
  },
  { timestamps: true }
);

templateSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    ret.imageUrl = `/uploads/${ret.imageFile}`;
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Template', templateSchema);
