import mongoose from 'mongoose';

const snapshot = new mongoose.Schema(
  { studentName: String, studentRef: { type: String, default: '' }, dateText: { type: String, default: '' } },
  { _id: false }
);
const person = new mongoose.Schema({ id: String, name: String }, { _id: false });

// A coordinator cannot alter an already-issued certificate. They file one of these,
// and the certificate only changes if an admin approves it.
const changeRequestSchema = new mongoose.Schema(
  {
    certificateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Certificate', required: true },
    certId: { type: String, required: true },
    program: { type: String, default: '' },
    current: { type: snapshot, required: true },
    proposed: { type: snapshot, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    requestedBy: { type: person, required: true },
    decidedBy: { type: person, default: undefined },
    decidedAt: Date,
    decisionNote: { type: String, default: '', maxlength: 500 }
  },
  { timestamps: true }
);

changeRequestSchema.index({ status: 1, createdAt: -1 });
changeRequestSchema.index({ certificateId: 1, status: 1 });

changeRequestSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    ret.certificateId = ret.certificateId.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('ChangeRequest', changeRequestSchema);
