import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronRight, FlaskConical, Loader2, Plus, Upload } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useProject } from "../../projects/ProjectContext";
import FolderTree from "./components/FolderTree";
import ImportTestCasesModal from "./components/ImportTestCasesModal";
import { CARD_CLASS } from "./constants";
import type { Folder, TestCase, TestSuite } from "./types";

type Crumb = { key: string; name: string; clickable: boolean };

function buildBreadcrumb(suite: TestSuite, folders: Folder[]): Crumb[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const path: Crumb[] = [];
  let current = byId.get(suite.folderId);
  while (current) {
    path.unshift({ key: current.id, name: current.name, clickable: true });
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  path.push({ key: suite.id, name: suite.name, clickable: false });
  return path;
}

export default function TestCasesPage() {
  const { currentProjectId, currentProject, loading: projectLoading } = useProject();
  const navigate = useNavigate();
  const { suiteId: suiteIdParam } = useParams<{ suiteId?: string }>();

  const [folders, setFolders] = useState<Folder[]>([]);
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [selectedSuite, setSelectedSuite] = useState<TestSuite | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingCases, setLoadingCases] = useState(false);
  const [error, setError] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    if (!currentProjectId) {
      setLoadingTree(false);
      return;
    }
    loadTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId]);

  useEffect(() => {
    if (!suiteIdParam) {
      setSelectedSuite(null);
      return;
    }
    const match = suites.find((s) => s.id === suiteIdParam);
    if (match) setSelectedSuite(match);
  }, [suiteIdParam, suites]);

  function selectSuite(suite: TestSuite) {
    navigate(`/test-cases/suite/${suite.id}`);
  }

  useEffect(() => {
    if (selectedSuite) loadTestCases(selectedSuite.id);
    else setTestCases([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSuite]);

  async function loadTree() {
    setLoadingTree(true);
    setError("");
    try {
      const [folderList, suiteList] = await Promise.all([
        api.get<Folder[]>(`/api/folders?projectId=${currentProjectId}`),
        api.get<TestSuite[]>(`/api/test-suites?projectId=${currentProjectId}`),
      ]);
      setFolders(folderList);
      setSuites(suiteList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the test repository.");
    } finally {
      setLoadingTree(false);
    }
  }

  async function loadTestCases(testSuiteId: string) {
    setLoadingCases(true);
    try {
      const { testCases: list } = await api.get<{ testCases: TestCase[]; total: number }>(
        `/api/test-cases?projectId=${currentProjectId}&testSuiteId=${testSuiteId}`,
      );
      setTestCases(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load test cases.");
    } finally {
      setLoadingCases(false);
    }
  }

  async function handleCreateFolder(parentId: string | null, name: string) {
    try {
      const folder = await api.post<Folder>("/api/folders", { projectId: currentProjectId, name, parentId });
      setFolders((prev) => [...prev, folder]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create folder.");
    }
  }

  async function handleCreateSuite(folderId: string, name: string) {
    try {
      const suite = await api.post<TestSuite>("/api/test-suites", { projectId: currentProjectId, folderId, name });
      setSuites((prev) => [...prev, suite]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create test suite.");
    }
  }

  async function handleRenameFolder(folderId: string, name: string) {
    try {
      const updated = await api.patch<Folder>(`/api/folders/${folderId}`, { name });
      setFolders((prev) => prev.map((f) => (f.id === folderId ? updated : f)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not rename folder.");
    }
  }

  async function handleDeleteFolder(folder: Folder) {
    if (!window.confirm(`Delete folder "${folder.name}"? It must be empty first.`)) return;
    try {
      await api.delete(`/api/folders/${folder.id}`);
      setFolders((prev) => prev.filter((f) => f.id !== folder.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete folder.");
    }
  }

  async function handleRenameSuite(suiteId: string, name: string) {
    try {
      const updated = await api.patch<TestSuite>(`/api/test-suites/${suiteId}`, { name });
      setSuites((prev) => prev.map((s) => (s.id === suiteId ? { ...s, ...updated } : s)));
      setSelectedSuite((prev) => (prev?.id === suiteId ? { ...prev, ...updated } : prev));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not rename test suite.");
    }
  }

  async function handleDeleteSuite(suite: TestSuite) {
    if (!window.confirm(`Delete test suite "${suite.name}"? It must be empty first.`)) return;
    try {
      await api.delete(`/api/test-suites/${suite.id}`);
      setSuites((prev) => prev.filter((s) => s.id !== suite.id));
      if (selectedSuite?.id === suite.id) navigate("/test-cases");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete test suite.");
    }
  }

  if (!projectLoading && !currentProjectId) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Test Cases</h1>
        <div className={CARD_CLASS + " text-center text-sm text-slate-400 dark:text-slate-500"}>
          Create a project first — Test Cases live inside a project.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Test Cases</h1>
        {currentProject && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Project: {currentProject.name}</p>
        )}
      </div>
      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 items-start">
        <div className={CARD_CLASS}>
          {loadingTree ? (
            <p className="text-xs text-slate-400 dark:text-slate-500">Loading…</p>
          ) : (
            <FolderTree
              folders={folders}
              suites={suites}
              selectedSuiteId={selectedSuite?.id ?? null}
              onSelectSuite={selectSuite}
              onCreateFolder={handleCreateFolder}
              onCreateSuite={handleCreateSuite}
              onRenameFolder={handleRenameFolder}
              onDeleteFolder={handleDeleteFolder}
              onRenameSuite={handleRenameSuite}
              onDeleteSuite={handleDeleteSuite}
            />
          )}
        </div>

        <div className={CARD_CLASS + " space-y-4"}>
          {!selectedSuite ? (
            <div className="text-center py-10 text-sm text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
              <FlaskConical size={20} className="text-slate-300 dark:text-slate-700" />
              Select or create a Test Suite to view its Test Cases.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 mb-1">
                    <button
                      onClick={() => navigate("/test-cases")}
                      className="hover:text-blue-400 hover:underline"
                      title="Back to Test Repository"
                    >
                      Test Cases
                    </button>
                    <ChevronRight size={11} />
                    {buildBreadcrumb(selectedSuite, folders).map((crumb, i, arr) => (
                      <span key={crumb.key} className="flex items-center gap-1.5">
                        {crumb.clickable ? (
                          <button onClick={() => navigate("/test-cases")} className="hover:text-blue-400 hover:underline">
                            {crumb.name}
                          </button>
                        ) : (
                          <span>{crumb.name}</span>
                        )}
                        {i < arr.length - 1 && <ChevronRight size={11} />}
                      </span>
                    ))}
                  </div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{selectedSuite.name}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800 text-xs font-medium rounded-lg px-3.5 py-2"
                  >
                    <Upload size={13} /> Import Test Cases
                  </button>
                  <button
                    onClick={() => navigate(`/test-cases/suite/${selectedSuite.id}/new`)}
                    className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
                  >
                    <Plus size={13} /> Create Test Case
                  </button>
                </div>
              </div>

              {loadingCases ? (
                <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-6 justify-center">
                  <Loader2 size={14} className="animate-spin" /> Loading…
                </div>
              ) : testCases.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">
                  No test cases yet in this suite.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {testCases.map((tc) => (
                    <button
                      key={tc.id}
                      onClick={() => navigate(`/test-cases/case/${tc.id}`)}
                      className="w-full flex items-center justify-between gap-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-950/40 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {tc.code} {tc.name}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {tc.testType} · {tc.stepCount ?? tc.steps?.length ?? 0} step
                          {(tc.stepCount ?? tc.steps?.length ?? 0) === 1 ? "" : "s"}
                          {tc.environment ? ` · ${tc.environment}` : ""}
                          {tc.testPhase ? ` · ${tc.testPhase}` : ""}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showImportModal && selectedSuite && currentProjectId && (
        <ImportTestCasesModal
          projectId={currentProjectId}
          testSuiteId={selectedSuite.id}
          onClose={() => setShowImportModal(false)}
          onImported={() => loadTestCases(selectedSuite.id)}
        />
      )}
    </div>
  );
}
