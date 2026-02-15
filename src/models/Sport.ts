import mongoose from "mongoose";

const SportSchema = new mongoose.Schema(
  {
    name: {
      me: { type: String, required: true },
      en: { type: String, required: true },
    },
    slug: { type: String, required: true, unique: true },
    description: { me: String, en: String },
    icon: String,
    coverImage: String,
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Sport = mongoose.models.Sport ?? mongoose.model("Sport", SportSchema);
