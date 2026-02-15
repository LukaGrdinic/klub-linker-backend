import mongoose from "mongoose";

const ClubRegistrationInviteSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const ClubRegistrationInvite =
  mongoose.models.ClubRegistrationInvite ??
  mongoose.model("ClubRegistrationInvite", ClubRegistrationInviteSchema);
