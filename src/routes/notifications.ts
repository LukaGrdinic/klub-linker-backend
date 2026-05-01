import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/roleCheck";
import { Club } from "../models/Club";
import { Notification } from "../models/Notification";
import { User } from "../models/User";
import {
  buildNotificationBatchItems,
  resolveRecipientEmails,
  sendNotificationEmailBatches,
  type RecipientInput,
} from "../services/notificationDelivery";
import { getResendClient } from "../utils/resendClient";

const router = Router();

const recipientSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("all") }),
  z.object({
    type: z.literal("custom"),
    userIds: z.array(z.string()).min(1),
  }),
  z.object({
    type: z.literal("club"),
    clubId: z.string().min(1),
  }),
]);

const sendNotificationSchema = z.object({
  title: z.string().min(1).max(500),
  message: z.string().min(1).max(50_000),
  clubId: z.string().min(1),
  recipients: z.array(recipientSchema).min(1),
  channels: z
    .array(z.enum(["email", "sms", "viber", "whatsapp"]))
    .optional(),
});

function mongoRecipients(recipients: RecipientInput[]) {
  return recipients.map((r) => {
    if (r.type === "all") return { type: "all" as const };
    if (r.type === "custom") {
      return {
        type: "custom" as const,
        userIds: r.userIds
          .filter((id) => mongoose.isValidObjectId(id))
          .map((id) => new mongoose.Types.ObjectId(id)),
      };
    }
    return {
      type: "club" as const,
      clubId: new mongoose.Types.ObjectId(r.clubId),
    };
  });
}

async function canSendForClub(
  userId: string,
  role: string,
  clubId: string,
): Promise<boolean> {
  if (!mongoose.isValidObjectId(clubId)) return false;
  const club = await Club.findById(clubId).select("status").lean();
  if (!club || club.status !== "approved") return false;
  if (role === "superAdmin") return true;
  if (role !== "clubAdmin") return false;
  const user = await User.findById(userId).select("clubId role").lean();
  if (!user?.clubId || String(user.clubId) !== clubId) return false;
  return true;
}

router.get("/", (_req, res) => {
  res.json({ message: "Notifications list - Faza 2", data: [] });
});

router.post(
  "/send",
  requireAuth,
  requireRole("clubAdmin"),
  async (req: Request, res: Response) => {
    try {
      const parsed = sendNotificationSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: "Neispravni podaci.",
          details: parsed.error.flatten(),
        });
        return;
      }

      const auth = req as Request & { userId?: string; userRole?: string };
      const userId = auth.userId;
      const role = auth.userRole ?? "";
      if (!userId) {
        res.status(401).json({ error: "Nije autentifikovan." });
        return;
      }

      const body = parsed.data;
      const channels =
        body.channels && body.channels.length > 0 ? body.channels : ["email"];

      if (!channels.includes("email")) {
        res.status(400).json({
          error: "Trenutno je podržan samo kanal email.",
        });
        return;
      }

      if (
        role === "clubAdmin" &&
        body.recipients.some((r) => r.type === "club")
      ) {
        res.status(403).json({
          error:
            "Primatelji tipa „club” su dostupni samo super administratoru.",
        });
        return;
      }

      const clubOid = new mongoose.Types.ObjectId(body.clubId);
      const allowed = await canSendForClub(userId, role, body.clubId);
      if (!allowed) {
        res.status(403).json({ error: "Nije dozvoljeno slanje za ovaj klub." });
        return;
      }

      const sender = await User.findById(userId).select("name").lean();
      const clubDoc = await Club.findById(clubOid).select("name logo").lean();
      if (!clubDoc) {
        res.status(404).json({ error: "Klub nije pronađen." });
        return;
      }

      const recipientsResolved = await resolveRecipientEmails(
        clubOid,
        body.recipients as RecipientInput[],
        role,
      );

      const doc = await Notification.create({
        title: body.title,
        message: body.message,
        recipients: mongoRecipients(body.recipients as RecipientInput[]),
        clubId: clubOid,
        channels,
        sentBy: new mongoose.Types.ObjectId(userId),
        status: "pending",
      });

      const total = recipientsResolved.length;

      if (total === 0) {
        await Notification.findByIdAndUpdate(doc._id, {
          status: "failed",
          sentAt: new Date(),
          deliveryStats: {
            total: 0,
            sent: 0,
            failed: 0,
            failedRecipients: [],
          },
        });
        res.status(200).json({
          notificationId: String(doc._id),
          status: "failed",
          deliveryStats: {
            total: 0,
            sent: 0,
            failed: 0,
            failedRecipients: [],
          },
          message: "Nema odobrenih primalaca za dati izbor.",
        });
        return;
      }

      const resend = getResendClient();
      if (!resend) {
        await Notification.findByIdAndUpdate(doc._id, {
          status: "failed",
          sentAt: new Date(),
          deliveryStats: {
            total,
            sent: 0,
            failed: total,
            failedRecipients: recipientsResolved,
          },
        });
        res.status(503).json({
          notificationId: String(doc._id),
          status: "failed",
          deliveryStats: {
            total,
            sent: 0,
            failed: total,
            failedRecipients: recipientsResolved,
          },
          error: "RESEND_API_KEY nije konfigurisan.",
        });
        return;
      }

      const items = buildNotificationBatchItems(recipientsResolved, {
        title: body.title,
        message: body.message,
        senderName: sender?.name ?? "Administrator",
        clubName: clubDoc.name ?? "",
        clubLogoUrl: clubDoc.logo ?? null,
      });

      const { sent, failedRecipients } = await sendNotificationEmailBatches({
        resend,
        items,
      });

      const failed = failedRecipients.length;
      const finalStatus = sent === 0 ? "failed" : "sent";

      await Notification.findByIdAndUpdate(doc._id, {
        status: finalStatus,
        sentAt: new Date(),
        deliveryStats: {
          total,
          sent,
          failed,
          failedRecipients,
        },
      });

      res.status(200).json({
        notificationId: String(doc._id),
        status: finalStatus,
        deliveryStats: {
          total,
          sent,
          failed,
          failedRecipients,
        },
      });
    } catch (err) {
      console.error("Notification send error:", err);
      res.status(500).json({ error: "Greška pri slanju obavještenja." });
    }
  },
);

router.post("/", (_req, res) => {
  res.status(400).json({
    error: "Koristite POST /api/notifications/send za slanje obavještenja.",
  });
});

export default router;
