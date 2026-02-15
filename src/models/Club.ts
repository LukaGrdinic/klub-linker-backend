import mongoose from "mongoose";

const ClubSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    sportId: { type: mongoose.Schema.Types.ObjectId, ref: "Sport", required: true },
    logo: String,
    coverImage: String,
    description: { me: String, en: String },
    location: { city: String, country: { type: String, default: "Crna Gora" } },
    foundedYear: Number,
    website: String,
    socialMedia: { facebook: String, instagram: String, twitter: String },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const Club = mongoose.models.Club ?? mongoose.model("Club", ClubSchema);
