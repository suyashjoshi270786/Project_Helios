// Defensive redaction — applied to anything derived from page content
// (console/network text, error messages, the assembled report) before it's
// logged, persisted, or returned, in case the target application itself
// echoed a credential value into visible text. This is a belt-and-braces
// layer: the credentials object itself is never handed to anything that
// logs, persists, or reports (see orchestrator.ts), so in the normal case
// this function has nothing to redact.
export function maskSecrets(text: string | null | undefined, secrets: (string | null | undefined)[]): string {
  if (!text) return text ?? "";
  let masked = text;
  for (const secret of secrets) {
    if (!secret || secret.length < 2) continue;
    const escaped = secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    masked = masked.replace(new RegExp(escaped, "gi"), "[REDACTED]");
  }
  return masked;
}

export function maskSecretsDeep<T>(value: T, secrets: (string | null | undefined)[]): T {
  if (typeof value === "string") return maskSecrets(value, secrets) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => maskSecretsDeep(v, secrets)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = maskSecretsDeep(v, secrets);
    }
    return out as T;
  }
  return value;
}
