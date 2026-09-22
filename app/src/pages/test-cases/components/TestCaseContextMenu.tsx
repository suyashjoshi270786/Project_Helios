import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Copy, CopyPlus, ExternalLink, MoveRight, PlayCircle, Trash2 } from "lucide-react";

// No context-menu primitive exists elsewhere in the app — this is a small,
// self-contained one: fixed-positioned at the click point, portal-rendered
// above everything, closes on click-outside or Escape.
export default function TestCaseContextMenu({
  x,
  y,
  count,
  onOpen,
  onDuplicate,
  onMove,
  onCopy,
  onAddToCycle,
  onDelete,
  onClose,
}: {
  x: number;
  y: number;
  count: number;
  onOpen: () => void;
  onDuplicate: () => void;
  onMove: () => void;
  onCopy: () => void;
  onAddToCycle: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Keep the menu on-screen near the cursor rather than letting it overflow
  // the viewport edge.
  const left = Math.min(x, window.innerWidth - 200);
  const top = Math.min(y, window.innerHeight - 220);

  const itemClass =
    "w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors";

  return createPortal(
    <div
      ref={ref}
      style={{ left, top }}
      className="fixed z-50 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg py-1"
    >
      {count > 1 && (
        <div className="px-3 py-1 text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
          {count} selected
        </div>
      )}
      {count === 1 && (
        <button onClick={onOpen} className={itemClass}>
          <ExternalLink size={13} /> Open
        </button>
      )}
      {count === 1 && (
        <button onClick={onDuplicate} className={itemClass}>
          <CopyPlus size={13} /> Duplicate
        </button>
      )}
      <button onClick={onMove} className={itemClass}>
        <MoveRight size={13} /> Move to…
      </button>
      <button onClick={onCopy} className={itemClass}>
        <Copy size={13} /> Copy to…
      </button>
      <div className="my-1 border-t border-slate-200 dark:border-slate-800" />
      <button onClick={onAddToCycle} className={itemClass}>
        <PlayCircle size={13} /> Add to Test Cycle
      </button>
      <div className="my-1 border-t border-slate-200 dark:border-slate-800" />
      <button onClick={onDelete} className={itemClass + " text-red-500 hover:text-red-400"}>
        <Trash2 size={13} /> Delete
      </button>
    </div>,
    document.body,
  );
}
