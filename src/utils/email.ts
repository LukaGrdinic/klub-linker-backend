import { emailFrom, getResendClient } from "./resendClient";

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  const resend = getResendClient();
  if (!resend) {
    console.warn("RESEND_API_KEY nije postavljen, email nije poslan.");
    return false;
  }
  const { error } = await resend.emails.send({
    from: emailFrom(),
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
