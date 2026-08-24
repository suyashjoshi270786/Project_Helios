import { useRef, useState } from "react";
import { MoreVertical, Trash2 } from "lucide-react";
import { useClickOutside } from "../../../lib/useClickOutside";
import { WORK_ITEM_TYPE_LABELS } from "../constants";
import type { WorkItemType } from "../types";

const ALL_TYPES: WorkItemType[] = ["Initiative", "Epic", "Feature", "Story", "Task", "SubTask", "Defect"];

export default function ItemMenu({
  currentType,
  onChangeType,
  onDelete,
}: {
  currentType: WorkItemType;
  onChangeType: (type: WorkItemType) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, () => setOpen(false), open);

  function stop(e: React.SyntheticEvent) {
    e.stopPropagation();
  }

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        onPointerDown={stop}
        onClick={(e) => {
          stop(e);
          setOpen((v) => !v);
        }}
        title="More actions"
        className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 p-0.5 -m-0.5 rounded"
      >
        <MoreVertical size={13} />
      </button>
      {open && (
        <div
          onPointerDown={stop}
          onClick={stop}
          className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg overflow-hidden z-20"
        >
          <div className="px-3 py-1.5 text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide border-b border-slate-200 dark:border-slate-800">
            Change Type
          </div>
          {ALL_TYPES.filter((t) => t !== currentType).map((t) => (
            <button
              key={t}
              onClick={() => {
                onChangeType(t);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {WORK_ITEM_TYPE_LABELS[t]}
            </button>
          ))}
          <button
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors border-t border-slate-200 dark:border-slate-800"
          >
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
