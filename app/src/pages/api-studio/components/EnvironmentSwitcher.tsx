import { Settings2 } from "lucide-react";
import { ENVIRONMENT_CLASSIFICATION_BADGE_CLASS, SELECT_CLASS } from "../constants";
import type { ApiEnvironment } from "../types";

export default function EnvironmentSwitcher({
  environments,
  selectedEnvironmentId,
  onSelect,
  onManage,
}: {
  environments: ApiEnvironment[];
  selectedEnvironmentId: string | null;
  onSelect: (environmentId: string | null) => void;
  onManage: () => void;
}) {
  const selected = environments.find((e) => e.id === selectedEnvironmentId) ?? null;

  return (
    <div className="flex items-center gap-1.5">
      <select
        value={selectedEnvironmentId ?? ""}
        onChange={(e) => onSelect(e.target.value || null)}
        className={SELECT_CLASS + " w-auto text-xs py-1.5"}
        title="Active environment for Send"
      >
        <option value="">No environment</option>
        {environments.map((env) => (
          <option key={env.id} value={env.id}>
            {env.name}
          </option>
        ))}
      </select>
      {selected && selected.classification === "Production" && (
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${ENVIRONMENT_CLASSIFICATION_BADGE_CLASS.Production}`}>PROD</span>
      )}
      <button onClick={onManage} title="Manage Environments" className="text-slate-400 hover:text-indigo-500">
        <Settings2 size={14} />
      </button>
    </div>
  );
}
