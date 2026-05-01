import mongoose from "mongoose";
import type { Resend } from "resend";
import { User } from "../models/User";
import { buildNotificationEmailHtml } from "../utils/notificationEmailHtml";
import { emailFrom } from "../utils/resendClient";

const BATCH_MAX = 100;

export type RecipientInput =
  | { type: "all" }
  | { type: "custom"; userIds: string[] }
  | { type: "club"; clubId: string };

export async function resolveRecipientEmails(
  notificationClubId: mongoose.Types.ObjectId,
  recipients: RecipientInput[],
  senderRole: string,
): Promise<string[]> {
  const emails = new Set<string>();

  for (const r of recipients) {
    if (r.type === "all") {
      const users = await User.find({
        clubId: notificationClubId,
        role: "athlete",
        status: "approved",
        isActive: { $ne: false },
      })
        .select("email")
        .lean();
      users.forEach((u) => {
        if (u.email) emails.add(u.email);
      });
      continue;
    }

    if (r.type === "custom") {
      const ids = r.userIds
        .filter((id) => mongoose.isValidObjectId(id))
        .map((id) => new mongoose.Types.ObjectId(id));
      if (ids.length === 0) continue;
      const users = await User.find({
        _id: { $in: ids },
        clubId: notificationClubId,
        status: "approved",
        isActive: { $ne: false },
      })
        .select("email")
        .lean();
      users.forEach((u) => {
        if (u.email) emails.add(u.email);
      });
      continue;
    }

    if (r.type === "club") {
      if (senderRole !== "superAdmin") continue;
      if (!mongoose.isValidObjectId(r.clubId)) continue;
      const cid = new mongoose.Types.ObjectId(r.clubId);
      const users = await User.find({
        clubId: cid,
        role: "athlete",
        status: "approved",
        isActive: { $ne: false },
      })
        .select("email")
        .lean();
      users.forEach((u) => {
        if (u.email) emails.add(u.email);
      });
    }
  }

  return [...emails];
}

type BatchItem = { to: string; html: string; subject: string };

type ResendBatchPermissiveBody = {
  data?: { id?: string | null }[];
  errors?: { index: number; message: string }[];
};

export async function sendNotificationEmailBatches(params: {
  resend: Resend;
  items: BatchItem[];
}): Promise<{ sent: number; failedRecipients: string[] }> {
  const from = emailFrom();
  let sent = 0;
  const failedRecipients: string[] = [];

  for (let i = 0; i < params.items.length; i += BATCH_MAX) {
    const slice = params.items.slice(i, i + BATCH_MAX);
    const batchEmails = slice.map((item) => ({
      from,
      to: item.to,
      subject: item.subject,
      html: item.html,
    }));

    const result = await params.resend.batch.send(batchEmails, {
      batchValidation: "permissive",
    });

    if (result.error || result.data === null) {
      slice.forEach((s) => failedRecipients.push(s.to));
      continue;
    }

    const batchBody = result.data as unknown as ResendBatchPermissiveBody;

    const errs = batchBody.errors ?? [];
    if (errs.length === 0) {
      sent += slice.length;
      continue;
    }

    const failedIdx = new Set(
      errs.map((e: { index: number }) => e.index),
    );
    slice.forEach((s, idx) => {
      if (failedIdx.has(idx)) failedRecipients.push(s.to);
      else sent++;
    });
  }

  return { sent, failedRecipients };
}

export function buildNotificationBatchItems(
  recipientEmails: string[],
  emailParams: {
    title: string;
    message: string;
    senderName: string;
    clubName: string;
    clubLogoUrl?: string | null;
  },
): BatchItem[] {
  const html = buildNotificationEmailHtml({
    title: emailParams.title,
    message: emailParams.message,
    senderName: emailParams.senderName,
    clubName: emailParams.clubName,
    clubLogoUrl: emailParams.clubLogoUrl,
  });

  return recipientEmails.map((to) => ({
    to,
    subject: emailParams.title,
    html,
  }));
}
