import { useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, Copy, Folder as FolderIcon, FlaskConical, Loader2, MoveRight, X } from "lucide-react";
import { api, ApiError } from "../../../lib/api";
import type { Folder, TestSuite } from "../types";

type Props = {
  mode: "move" | "copy";
  testCaseIds: string[];
  folders: Folder[];
  suites: TestSuite[];
  onClose: () => void;
  onDone: (result: { mode: "move" | "copy"; count: number; testSuiteId: string; suiteName: string }) => void;
};

function FolderNode({
  folder,
  depth,
  folders,
  suites,
  expanded,
  onToggle,
  selectedSuiteId,
  onSelectSuite,
}: {
  folder: Folder;
  depth: number;
  folders: Folder[];
  suites: TestSuite[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
  selectedSuiteId: string | null;
  onSelectSuite: (suite: TestSuite) => void;
}) {
  const children = folders.filter((f) => f.parentId === folder.id);
  const suitesHere = suites.filter((s) => s.folderId === folder.id);
  const isOpen = expanded.has(folder.id);

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(folder.id)}
        className="w-full flex items-center gap-1.5 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition-colors"
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        <ChevronRight size={13} className={`shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`} />
        <FolderIcon size={13} className="shrink-0 text-slate-400 dark:text-slate-500" />
        <span className="text-xs text-slate-700 dark:text-slate-300 truncate">{folder.name}</span>
      </button>
      {isOpen && (
        <div>
          {children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              folders={folders}
              suites={suites}
              expanded={expanded}
              onToggle={onToggle}
              selectedSuiteId={selectedSuiteId}
              onSelectSuite={onSelectSuite}
            />
          ))}
          {suitesHere.map((suite) => (
            <button
              key={suite.id}
              type="button"
              onClick={() => onSelectSuite(suite)}
              className={`w-full flex items-center gap-1.5 py-1.5 rounded-md text-left transition-colors ${
                selectedSuiteId === suite.id
                  ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
              style={{ paddingLeft: 8 + (depth + 1) * 16 }}
            >
              <FlaskConical size={13} className="shrink-0" />
              <span className="text-xs truncate">{suite.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Destination must be a TestSuite leaf, not just a folder — that's the
// actual FK that moves (TestCase.testSuiteId). The folder tree is for
// navigation only, same read-only-picker idea as FolderTree.tsx's
// structure without its inline-edit/drag affordances.
export default function MoveCopyTestCasesModal({ mode, testCaseIds, folders, suites, onClose, onDone }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(folders.filter((f) => !f.parentId).map((f) => f.id)));
  const [selectedSuite, setSelectedSuite] = useState<TestSuite | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirm() {
    if (!selectedSuite) return;
    setSubmitting(true);
    setError("");
    try {
      const endpoint = mode === "move" ? "/api/test-cases/bulk-move" : "/api/test-cases/bulk-copy";
      await api.post(endpoint, { testCaseIds, testSuiteId: selectedSuite.id });
      onDone({ mode, count: testCaseIds.length, testSuiteId: selectedSuite.id, suiteName: selectedSuite.name });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not ${mode} those test cases.`);
      setSubmitting(false);
    }
  }

  const rootFolders = folders.filter((f) => !f.parentId);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
            {mode === "move" ? <MoveRight size={15} /> : <Copy size={15} />}
            {mode === "move" ? "Move" : "Copy"} {testCaseIds.length} Test Case{testCaseIds.length === 1 ? "" : "s"}
          </h2>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-400 dark:text-slate-500">Select a destination test suite.</p>
          <div className="max-h-72 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg p-1.5">
            {rootFolders.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 px-2 py-3">No folders yet.</p>
            ) : (
              rootFolders.map((folder) => (
                <FolderNode
                  key={folder.id}
                  folder={folder}
                  depth={0}
                  folders={folders}
                  suites={suites}
                  expanded={expanded}
                  onToggle={toggle}
                  selectedSuiteId={selectedSuite?.id ?? null}
                  onSelectSuite={setSelectedSuite}
                />
              ))
            )}
          </div>
          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800">
          <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm font-medium px-3 py-2">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedSuite || submitting}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 transition-colors text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            {submitting && <Loader2 size={13} className="animate-spin" />}
            {mode === "move" ? "Move Here" : "Copy Here"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
