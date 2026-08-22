import { Resend } from "resend";

let resend: Resend | null = null;

function getClient() {
  if (resend) return resend;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  resend = new Resend(apiKey);
  return resend;
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const client = getClient();
  if (!client) {
    // No email provider configured (or not yet set up with a verified
    // domain) — log the link instead of failing the request outright, so
    // the reset flow stays usable in the meantime.
    console.log(`[password reset] No email provider configured. Link for ${to}: ${resetUrl}`);
    return;
  }

  // resend.dev works out of the box with no domain verification, but its
  // sandbox mode can only deliver to the Resend account's own email until a
  // real domain is verified. Set RESEND_FROM once that's done.
  const fromAddress = process.env.RESEND_FROM || "onboarding@resend.dev";

  const { error } = await client.emails.send({
    from: `HeliosQE <${fromAddress}>`,
    to,
    subject: "Reset your HeliosQE password",
    text: `We received a request to reset your HeliosQE password.\n\nReset it here (this link expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `
      <p>We received a request to reset your HeliosQE password.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a> (this link expires in 1 hour).</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  });

  if (error) {
    console.log(`[password reset] Resend failed, falling back to logged link for ${to}: ${resetUrl}`);
    console.error("Resend send error:", error);
  }
}
