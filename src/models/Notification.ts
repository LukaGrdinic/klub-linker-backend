import mongoose from "mongoose";

const RecipientSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["all", "club", "custom"],
    },
    userIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", default: null },
  },
  { _id: false }
);

const DeliveryStatsSchema = new mongoose.Schema(
  {
    total: Number,
    sent: Number,
    failed: Number,
    failedRecipients: [String],
  },
  { _id: false }
);

const NotificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    recipients: [RecipientSchema],
    clubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
      required: true,
    },
    channels: [
      {
        type: String,
        enum: ["email", "sms", "viber", "whatsapp"],
      },
    ],
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "sent", "failed"],
    },
    sentAt: Date,
    deliveryStats: DeliveryStatsSchema,
  },
  { timestamps: true }
);

export const Notification =
  mongoose.models.Notification ??
  mongoose.model("Notification", NotificationSchema);
