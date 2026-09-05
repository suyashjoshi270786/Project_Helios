import { AlertTriangle } from "lucide-react";
import { INPUT_CLASS, LABEL_CLASS, SELECT_CLASS } from "../../constants";
import type { ApiAuthType } from "../../types";

type BearerConfig = { token: string };
type BasicConfig = { username: string; password: string };
type ApiKeyConfig = { key: string; value: string; in: "header" | "query" };

const TEMPLATE_VAR_PATTERN = /\{\{([^{}]+)\}\}/;

function authValues(authType: ApiAuthType, config: Record<string, unknown>): string[] {
  if (authType === "Bearer") return [String((config as Partial<BearerConfig>).token ?? "")];
  if (authType === "Basic") return [String((config as Partial<BasicConfig>).username ?? ""), String((config as Partial<BasicConfig>).password ?? "")];
  if (authType === "ApiKey") return [String((config as Partial<ApiKeyConfig>).value ?? "")];
  return [];
}

// "missing" = the value is flatly empty, needs typing in before Send will
// work at all. "template" = it references a {{variable}} — not wrong, but
// the request will block with MISSING_VARIABLES unless that variable is
// defined in the active Environment, so it's worth flagging either way.
export function authAttentionState(authType: ApiAuthType, authConfig: unknown): "missing" | "template" | null {
  if (authType === "None") return null;
  const values = authValues(authType, (authConfig ?? {}) as Record<string, unknown>);
  if (values.every((v) => !v)) return "missing";
  if (values.some((v) => TEMPLATE_VAR_PATTERN.test(v))) return "template";
  return null;
}

export default function AuthTab({
  authType,
  authConfig,
  onAuthTypeChange,
  onAuthConfigChange,
}: {
  authType: ApiAuthType;
  authConfig: unknown;
  onAuthTypeChange: (type: ApiAuthType) => void;
  onAuthConfigChange: (config: unknown) => void;
}) {
  const config = (authConfig ?? {}) as Record<string, unknown>;
  const attention = authAttentionState(authType, authConfig);

  return (
    <div className="space-y-4 max-w-md">
      {attention === "missing" && (
        <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-lg px-3 py-2">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <span>This request requires {authType === "Bearer" ? "a Bearer token" : authType === "Basic" ? "a username and password" : "an API key value"}, but it's currently empty — fill it in below before sending.</span>
        </div>
      )}
      {attention === "template" && (
        <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-lg px-3 py-2">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <span>This value references a template variable — make sure it's defined in your active Environment, or Send will block with a missing-variable error.</span>
        </div>
      )}
      <div>
        <label className={LABEL_CLASS}>Authentication Type</label>
        <select value={authType} onChange={(e) => onAuthTypeChange(e.target.value as ApiAuthType)} className={SELECT_CLASS}>
          <option value="None">None</option>
          <option value="Bearer">Bearer Token</option>
          <option value="Basic">Basic Auth</option>
          <option value="ApiKey">API Key</option>
        </select>
      </div>

      {authType === "Bearer" && (
        <div>
          <label className={LABEL_CLASS}>Token</label>
          <input
            value={(config as Partial<BearerConfig>).token ?? ""}
            onChange={(e) => onAuthConfigChange({ token: e.target.value })}
            placeholder="{{accessToken}} or a literal token"
            className={INPUT_CLASS}
          />
        </div>
      )}

      {authType === "Basic" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Username</label>
            <input
              value={(config as Partial<BasicConfig>).username ?? ""}
              onChange={(e) => onAuthConfigChange({ ...config, username: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>Password</label>
            <input
              type="password"
              value={(config as Partial<BasicConfig>).password ?? ""}
              onChange={(e) => onAuthConfigChange({ ...config, password: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      )}

      {authType === "ApiKey" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Key</label>
              <input
                value={(config as Partial<ApiKeyConfig>).key ?? ""}
                onChange={(e) => onAuthConfigChange({ ...config, key: e.target.value })}
                placeholder="X-API-Key"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Value</label>
              <input
                value={(config as Partial<ApiKeyConfig>).value ?? ""}
                onChange={(e) => onAuthConfigChange({ ...config, value: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
          </div>
          <div>
            <label className={LABEL_CLASS}>Add to</label>
            <select
              value={(config as Partial<ApiKeyConfig>).in ?? "header"}
              onChange={(e) => onAuthConfigChange({ ...config, in: e.target.value })}
              className={SELECT_CLASS}
            >
              <option value="header">Header</option>
              <option value="query">Query Parameter</option>
            </select>
          </div>
        </div>
      )}

      {authType === "None" && <p className="text-xs text-slate-400 dark:text-slate-500">This request sends no authentication.</p>}
    </div>
  );
}
