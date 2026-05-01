import { Resend } from "resend";

let instance: Resend | null = null;

export function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  if (!instance) instance = new Resend(key);
  return instance;
}

export function emailFrom(): string {
  const v = process.env.RESEND_FROM?.trim();
  return v || "Klub Linker <noreply@klublinker.me>";
}
