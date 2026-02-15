import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: {
      type: String,
      enum: ["superAdmin", "clubAdmin", "athlete"],
    },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", default: null },
    athleteProfile: {
      bio: String,
      photo: String,
      position: String,
      dateOfBirth: Date,
      nationality: String,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
    },
    emailVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const User = mongoose.models.User ?? mongoose.model("User", UserSchema);
