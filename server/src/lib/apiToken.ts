import crypto from "node:crypto";

// Same raw-token/hash pattern as PasswordResetToken and TeamInvite: only the
// hash is ever persisted, the raw value is shown to the user exactly once.
// A recognizable prefix (like GitHub's ghp_) makes a leaked token easy to
// spot in logs/scans and to tell apart from other secrets at a glance.
export const API_TOKEN_PREFIX = "hqe_";

export function generateApiToken(): string {
  return `${API_TOKEN_PREFIX}${crypto.randomBytes(32).toString("hex")}`;
}

export function hashApiToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
