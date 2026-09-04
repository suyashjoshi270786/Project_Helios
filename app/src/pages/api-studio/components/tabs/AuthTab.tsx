import { INPUT_CLASS, LABEL_CLASS, SELECT_CLASS } from "../../constants";
import type { ApiAuthType } from "../../types";

type BearerConfig = { token: string };
type BasicConfig = { username: string; password: string };
type ApiKeyConfig = { key: string; value: string; in: "header" | "query" };

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

  return (
    <div className="space-y-4 max-w-md">
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
