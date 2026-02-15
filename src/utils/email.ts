import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!resend) {
    console.warn("RESEND_API_KEY nije postavljen, email nije poslan.");
    return false;
  }
  const { error } = await resend.emails.send({
    from: "Klub Linker <onboarding@resend.dev>",
    to,
    subject,
    html,
  });
  if (error) {
    console.error("Resend error:", error);
    return false;
  }
  return true;
}

export { resend };
