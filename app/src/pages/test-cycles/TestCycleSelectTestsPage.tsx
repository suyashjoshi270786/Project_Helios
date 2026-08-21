import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useProject } from "../../projects/ProjectContext";
import FolderTree from "../test-cases/components/FolderTree";
import type { Folder, TestCase, TestSuite } from "../test-cases/types";
import { CARD_CLASS } from "./constants";
import type { TestCycleDetail } from "./types";

export default function TestCycleSelectTestsPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const { currentProjectId } = useProject();
  const navigate = useNavigate();

  const [cycle, setCycle] = useState<TestCycleDetail | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [selectedSuite, setSelectedSuite] = useState<TestSuite | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingCases, setLoadingCases] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const alreadyInCycle = useMemo(() => new Set((cycle?.tests ?? []).map((t) => t.testCaseId)), [cycle]);

  useEffect(() => {
    if (!cycleId || !currentProjectId) return;
    (async () => {
      setLoadingTree(true);
      setError("");
      try {
        const [cycleData, folderList, suiteList] = await Promise.all([
          api.get<TestCycleDetail>(`/api/test-cycles/${cycleId}`),
          api.get<Folder[]>(`/api/folders?projectId=${currentProjectId}`),
          api.get<TestSuite[]>(`/api/test-suites?projectId=${currentProjectId}`),
        ]);
        setCycle(cycleData);
        setFolders(folderList);
        setSuites(suiteList);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load the test repository.");
      } finally {
        setLoadingTree(false);
      }
    })();
  }, [cycleId, currentProjectId]);

  useEffect(() => {
    if (!selectedSuite) {
      setTestCases([]);
      return;
    }
    (async () => {
      setLoadingCases(true);
      try {
        const { testCases: list } = await api.get<{ testCases: TestCase[]; total: number }>(
          `/api/test-cases?projectId=${currentProjectId}&testSuiteId=${selectedSuite.id}`,
        );
        setTestCases(list);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load test cases.");
      } finally {
        setLoadingCases(false);
      }
    })();
  }, [selectedSuite, currentProjectId]);

  function toggle(id: string) {
    if (alreadyInCycle.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleOk() {
    if (!cycleId || selected.size === 0) {
      navigate(`/test-cycles/${cycleId}`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post(`/api/test-cycles/${cycleId}/tests`, { testCaseIds: [...selected] });
      navigate(`/test-cycles/${cycleId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the selected test cases.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            Select Tests {cycle ? `— ${cycle.name}` : ""}
          </h1>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            Navigate the folder hierarchy and choose the test cases to run in this cycle.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">{selected.size} selected</span>
          <button
            onClick={() => navigate(`/test-cycles/${cycleId}`)}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm font-medium px-3 py-2"
          >
            Cancel
          </button>
          <button
            onClick={handleOk}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-60 transition-colors text-white text-sm font-medium rounded-lg px-4 py-2"
          >
            {saving ? "Adding…" : "OK"}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 items-start">
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

        <div className={CARD_CLASS + " space-y-3"}>
          {!selectedSuite ? (
            <div className="text-center py-10 text-sm text-slate-400 dark:text-slate-500">
              Select a Test Suite on the left to see its test cases.
            </div>
          ) : loadingCases ? (
            <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-6 justify-center">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          ) : testCases.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">No test cases in this suite.</div>
          ) : (
            <>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{selectedSuite.name}</h2>
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {testCases.map((tc) => {
                  const inCycle = alreadyInCycle.has(tc.id);
                  return (
                    <label
                      key={tc.id}
                      className={`flex items-center gap-3 py-2.5 ${inCycle ? "opacity-50" : "cursor-pointer"}`}
                    >
                      <input
                        type="checkbox"
                        checked={inCycle || selected.has(tc.id)}
                        disabled={inCycle}
                        onChange={() => toggle(tc.id)}
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {tc.code} {tc.name}
                      </span>
                      {inCycle && (
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-auto">Already in this cycle</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
