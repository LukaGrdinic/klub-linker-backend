function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type NotificationEmailHtmlParams = {
  title: string;
  message: string;
  senderName: string;
  clubName: string;
  clubLogoUrl?: string | null;
};

export function buildNotificationEmailHtml(
  params: NotificationEmailHtmlParams,
): string {
  const docTitle = escapeHtml(params.title);
  const message = escapeHtml(params.message).replace(/\n/g, "<br/>");
  const senderName = escapeHtml(params.senderName);
  const clubName = escapeHtml(params.clubName);
  const logo =
    params.clubLogoUrl?.trim() &&
    /^https?:\/\//i.test(params.clubLogoUrl.trim())
      ? `<img src="${escapeHtml(params.clubLogoUrl.trim())}" alt="${clubName}" height="48" style="display:block;margin:0 auto;" />`
      : `<p style="margin:0;font-size:22px;font-weight:700;color:#171717;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">${clubName}</p>`;

  return `<!DOCTYPE html>
<html lang="sr-Latn">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>${docTitle}</title></head>
<body style="margin:0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;padding:32px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:8px;padding:40px 32px;">
<tr><td align="center" style="padding-bottom:24px;">${logo}</td></tr>
<tr><td><hr style="border:none;border-top:1px solid #e4e4e7;margin:0 0 24px"/></td></tr>
<tr><td style="font-size:16px;line-height:26px;color:#171717;padding-bottom:16px;">Pozdrav,</td></tr>
<tr><td style="font-size:16px;line-height:26px;color:#171717;">${message}</td></tr>
<tr><td><hr style="border:none;border-top:1px solid #e4e4e7;margin:32px 0 16px"/></td></tr>
<tr><td style="font-size:14px;line-height:22px;color:#71717a;">Poslao: ${senderName}, ${clubName}</td></tr>
<tr><td style="font-size:14px;line-height:22px;color:#71717a;padding-top:8px;">Klub Linker</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
