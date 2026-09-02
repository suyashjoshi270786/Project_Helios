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


export async function sendAccessRequestEmail(
  notifyTo: string,
  requesterName: string,
  requesterEmail: string,
  requesterPhone: string | undefined,
  reason: string | undefined,
) {
  const client = getClient();
  const body = `${requesterName} (${requesterEmail}${requesterPhone ? `, ${requesterPhone}` : ""}) requested access to HeliosQE.${reason ? `\n\nReason: ${reason}` : ""}\n\nReview it from the Team page.`;
  if (!client) {
    console.log(`[access request] No email provider configured. ${body}`);
    return;
  }

  const fromAddress = process.env.RESEND_FROM || "onboarding@resend.dev";

  const { error } = await client.emails.send({
    from: `HeliosQE <${fromAddress}>`,
    to: notifyTo,
    subject: `New HeliosQE access request from ${requesterName}`,
    text: body,
    html: `
      <p><strong>${requesterName}</strong> (${requesterEmail}) requested access to HeliosQE.</p>
      ${requesterPhone ? `<p>Phone: ${requesterPhone}</p>` : ""}
      ${reason ? `<p>Reason: ${reason}</p>` : ""}
      <p>Review it from the Team page.</p>
    `,
  });

  if (error) {
    console.log(`[access request] Resend failed, falling back to logged notification: ${body}`);
    console.error("Resend send error:", error);
  }
}

export async function sendNewAccountEmail(to: string, name: string, email: string, temporaryPassword: string, loginUrl: string) {
  const client = getClient();
  const body = `Hi ${name}, your HeliosQE account is ready.\n\nEmail: ${email}\nTemporary password: ${temporaryPassword}\n\nSign in here and change your password once you're in:\n${loginUrl}`;
  if (!client) {
    console.log(`[new account] No email provider configured. ${body}`);
    return;
  }

  const fromAddress = process.env.RESEND_FROM || "onboarding@resend.dev";

  const { error } = await client.emails.send({
    from: `HeliosQE <${fromAddress}>`,
    to,
    subject: "Your HeliosQE account is ready",
    text: body,
    html: `
      <p>Hi ${name}, your HeliosQE account is ready.</p>
      <p>Email: ${email}<br>Temporary password: <strong>${temporaryPassword}</strong></p>
      <p><a href="${loginUrl}">Sign in</a> and change your password once you're in.</p>
    `,
  });

  if (error) {
    console.log(`[new account] Resend failed, falling back to logged notification: ${body}`);
    console.error("Resend send error:", error);
  }
}
