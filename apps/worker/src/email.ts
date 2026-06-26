import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransport(): Transporter | null {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

export type SendResult = "sent" | "skipped";

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const t = getTransport();
  if (!t) return "skipped"; // SMTP not configured yet (infra step)
  await t.sendMail({
    from: process.env.SMTP_FROM ?? "Event Platform <no-reply@example.com>",
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
  return "sent";
}
