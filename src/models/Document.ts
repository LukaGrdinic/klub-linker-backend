import mongoose from "mongoose";

const DocumentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    fileUrl: { type: String, required: true },
    fileType: String,
    fileSize: Number,
    clubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: String,
      enum: ["financije", "treniranje", "utakmice", "ostalo"],
    },
    isPrivate: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Document =
  mongoose.models.Document ?? mongoose.model("Document", DocumentSchema);
