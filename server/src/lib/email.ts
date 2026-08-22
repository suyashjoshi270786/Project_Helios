import nodemailer from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in server/.env.");
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    // Many hosting platforms (Render included) don't route outbound IPv6,
    // but Gmail's DNS returns an IPv6 address first — force IPv4 so the
    // connection doesn't fail with ENETUNREACH on that address. `family`
    // is a real Node net-connect option nodemailer forwards through, but
    // it isn't in the published @types, hence the cast.
    family: 4,
  } as nodemailer.TransportOptions);
  return transporter;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER!;
  await getTransporter().sendMail({
    from: `"HeliosQE" <${fromAddress}>`,
    to,
    subject: "Reset your HeliosQE password",
    text: `We received a request to reset your HeliosQE password.\n\nReset it here (this link expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `
      <p>We received a request to reset your HeliosQE password.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a> (this link expires in 1 hour).</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });
}
