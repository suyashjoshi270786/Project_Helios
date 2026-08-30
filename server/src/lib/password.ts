import crypto from "crypto";

export function generateTemporaryPassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}
