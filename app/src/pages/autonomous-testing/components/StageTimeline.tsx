import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { STAGE_LABELS, STAGE_STATUS_BADGE_CLASS } from "../constants";
import type { AutonomousStage } from "../types";

function StatusBadge({ stage }: { stage: AutonomousStage }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${STAGE_STATUS_BADGE_CLASS[stage.status]}`}>
      {stage.status === "Running" && <Loader2 size={10} className="animate-spin" />}
      {stage.status}
    </span>
  );
}

export default function StageTimeline({ stages }: { stages: AutonomousStage[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-1.5">
      {stages.map((stage) => {
        const isOpen = expanded === stage.id;
        const hasLogs = (stage.logs?.length ?? 0) > 0 || !!stage.error;
        return (
          <div key={stage.id} className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <button
              onClick={() => hasLogs && setExpanded(isOpen ? null : stage.id)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left ${hasLogs ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/60" : "cursor-default"}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {hasLogs ? (
                  isOpen ? (
                    <ChevronDown size={13} className="shrink-0 text-slate-400" />
                  ) : (
                    <ChevronRight size={13} className="shrink-0 text-slate-400" />
                  )
                ) : (
                  <span className="w-[13px] shrink-0" />
                )}
                <span className="text-sm text-slate-800 dark:text-slate-200 truncate">{STAGE_LABELS[stage.stage]}</span>
              </div>
              <StatusBadge stage={stage} />
            </button>
            {isOpen && (
              <div className="px-3 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800/60 space-y-1">
                {stage.error && (
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 rounded-md px-2.5 py-1.5 max-h-32 overflow-y-auto">
                    <p className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap break-words">{stage.error}</p>
                  </div>
                )}
                {stage.logs?.map((line, i) => (
                  <p key={i} className="text-[11px] font-mono text-slate-500 dark:text-slate-400 break-words">
                    {line}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
