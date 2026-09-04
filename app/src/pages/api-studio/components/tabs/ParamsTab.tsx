import { useMemo } from "react";
import { LABEL_CLASS, INPUT_CLASS } from "../../constants";
import KeyValueTable from "../KeyValueTable";
import type { KeyValuePair } from "../../types";

// Detects {name} tokens in the URL — these become read-only-key rows in the
// Path Parameters table below Query Parameters, matching the mockup.
function extractPathParamKeys(url: string): string[] {
  const matches = [...url.matchAll(/\{([a-zA-Z0-9_]+)\}/g)];
  return [...new Set(matches.map((m) => m[1]))];
}

export default function ParamsTab({
  url,
  queryParams,
  pathParams,
  onQueryParamsChange,
  onPathParamsChange,
}: {
  url: string;
  queryParams: KeyValuePair[];
  pathParams: KeyValuePair[];
  onQueryParamsChange: (rows: KeyValuePair[]) => void;
  onPathParamsChange: (rows: KeyValuePair[]) => void;
}) {
  const pathParamKeys = useMemo(() => extractPathParamKeys(url), [url]);

  function updatePathParamValue(key: string, value: string) {
    const existing = pathParams.find((p) => p.key === key);
    if (existing) {
      onPathParamsChange(pathParams.map((p) => (p.key === key ? { ...p, value } : p)));
    } else {
      onPathParamsChange([...pathParams, { key, value, enabled: true }]);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label className={LABEL_CLASS}>Query Parameters</label>
        <KeyValueTable rows={queryParams} onChange={onQueryParamsChange} />
      </div>

      {pathParamKeys.length > 0 && (
        <div>
          <label className={LABEL_CLASS}>Path Parameters</label>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-400 dark:text-slate-500">
                <th className="font-medium pb-1 pr-2 w-1/3">Key</th>
                <th className="font-medium pb-1">Value</th>
              </tr>
            </thead>
            <tbody>
              {pathParamKeys.map((key) => (
                <tr key={key}>
                  <td className="pr-2 py-0.5 text-slate-500 dark:text-slate-400 font-mono">{`{${key}}`}</td>
                  <td className="py-0.5">
                    <input
                      value={pathParams.find((p) => p.key === key)?.value ?? ""}
                      onChange={(e) => updatePathParamValue(key, e.target.value)}
                      className={INPUT_CLASS + " py-1"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
