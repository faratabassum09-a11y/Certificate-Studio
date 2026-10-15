import mongoose from 'mongoose';

// One document per certificate issued. Template snapshot fields (program, dateText)
// are stored so history stays readable even if the template is later renamed/deleted.
const certificateSchema = new mongoose.Schema(
  {
    certId: { type: String, required: true, unique: true }, // e.g. CS-2026-K7M2QX
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template', required: true },
    program: { type: String, required: true },
    studentName: { type: String, required: true, trim: true, maxlength: 200 },
    studentRef: { type: String, default: '', trim: true, maxlength: 100 }, // optional student ID / email
    studentKey: { type: String, required: true }, // normalised identity used for duplicate checks
    dateText: { type: String, default: '' },
    issuedBy: { id: String, name: String }
  },
  { timestamps: true }
);

// One certificate per student per program, enforced by the database (race-safe).
certificateSchema.index({ studentKey: 1, templateId: 1 }, { unique: true });
certificateSchema.index({ createdAt: -1 });

certificateSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    ret.templateId = ret.templateId.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.studentKey;
    return ret;
  }
});

export default mongoose.model('Certificate', certificateSchema);
