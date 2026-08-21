import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Loader2, X } from "lucide-react";
import { api, ApiError } from "../../../lib/api";
import FolderTree from "../../test-cases/components/FolderTree";
import type { Folder, TestCase, TestSuite } from "../../test-cases/types";
import { CARD_CLASS } from "../constants";

export default function LinkTestCasesModal({
  workItemId,
  projectId,
  alreadyLinkedIds,
  onClose,
  onLinked,
}: {
  workItemId: string;
  projectId: string;
  alreadyLinkedIds: string[];
  onClose: () => void;
  onLinked: () => void;
}) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [selectedSuite, setSelectedSuite] = useState<TestSuite | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingCases, setLoadingCases] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const alreadyLinked = useMemo(() => new Set(alreadyLinkedIds), [alreadyLinkedIds]);

  useEffect(() => {
    (async () => {
      setLoadingTree(true);
      setError("");
      try {
        const [folderList, suiteList] = await Promise.all([
          api.get<Folder[]>(`/api/folders?projectId=${projectId}`),
          api.get<TestSuite[]>(`/api/test-suites?projectId=${projectId}`),
        ]);
        setFolders(folderList);
        setSuites(suiteList);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load the test repository.");
      } finally {
        setLoadingTree(false);
      }
    })();
  }, [projectId]);

  useEffect(() => {
    if (!selectedSuite) {
      setTestCases([]);
      return;
    }
    (async () => {
      setLoadingCases(true);
      try {
        const { testCases: list } = await api.get<{ testCases: TestCase[]; total: number }>(
          `/api/test-cases?projectId=${projectId}&testSuiteId=${selectedSuite.id}`,
        );
        setTestCases(list);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load test cases.");
      } finally {
        setLoadingCases(false);
      }
    })();
  }, [selectedSuite, projectId]);

  function toggle(id: string) {
    if (alreadyLinked.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleLink() {
    if (selected.size === 0) {
      onClose();
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post(`/api/work-items/${workItemId}/test-cases`, { testCaseIds: [...selected] });
      onLinked();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not link the selected test cases.");
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-medium text-slate-900 dark:text-white">Link Test Cases</h2>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400 mb-3">
              <AlertCircle size={13} /> {error}
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4 items-start">
            <div className={CARD_CLASS}>
              {loadingTree ? (
                <p className="text-xs text-slate-400 dark:text-slate-500">Loading…</p>
              ) : (
                <FolderTree
                  folders={folders}
                  suites={suites}
                  selectedSuiteId={selectedSuite?.id ?? null}
                  onSelectSuite={setSelectedSuite}
                  onCreateFolder={() => {}}
                  onCreateSuite={() => {}}
                  onRenameFolder={() => {}}
                  onDeleteFolder={() => {}}
                  onRenameSuite={() => {}}
                  onDeleteSuite={() => {}}
                />
              )}
            </div>
            <div className={CARD_CLASS + " min-h-[200px]"}>
              {!selectedSuite ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">
                  Select a Test Suite on the left.
                </p>
              ) : loadingCases ? (
                <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-6 justify-center">
                  <Loader2 size={14} className="animate-spin" /> Loading…
                </div>
              ) : testCases.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">No test cases in this suite.</p>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {testCases.map((tc) => {
                    const linked = alreadyLinked.has(tc.id);
                    return (
                      <label key={tc.id} className={`flex items-center gap-3 py-2 ${linked ? "opacity-50" : "cursor-pointer"}`}>
                        <input type="checkbox" checked={linked || selected.has(tc.id)} disabled={linked} onChange={() => toggle(tc.id)} />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {tc.code} {tc.name}
                        </span>
                        {linked && <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-auto">Already linked</span>}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800">
          <span className="text-xs text-slate-400 dark:text-slate-500 mr-auto">{selected.size} selected</span>
          <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm font-medium px-3 py-2">
            Cancel
          </button>
          <button
            onClick={handleLink}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition-colors text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            {saving ? "Linking…" : "Link"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
