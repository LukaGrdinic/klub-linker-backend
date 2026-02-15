import mongoose from "mongoose";

const DocumentSchema = new mongoose.Schema(
  {
    title: String,
    fileUrl: String,
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club" },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Document =
  mongoose.models.Document ?? mongoose.model("Document", DocumentSchema);
