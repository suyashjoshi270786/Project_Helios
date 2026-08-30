import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import {
  ChevronRight, FlaskConical, GripVertical, Loader2, Plus, Upload, ListChecks, Bot, CheckCircle2, XCircle,
} from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useProject } from "../../projects/ProjectContext";
import StatTile from "../../components/StatTile";
import FolderTree from "./components/FolderTree";
import ImportTestCasesModal from "./components/ImportTestCasesModal";
import CascadeDeleteModal, { type CascadeCounts } from "./components/CascadeDeleteModal";
import { CARD_CLASS, BUTTON_PRIMARY_CLASS, BUTTON_SECONDARY_CLASS, TEST_CASE_TYPE_BADGE_CLASS, LATEST_STATUS_BADGE_CLASS, LATEST_STATUS_LABELS } from "./constants";
import type { Folder, TestCase, TestSuite } from "./types";

type Crumb = { key: string; name: string; clickable: boolean };
const testCaseDragId = (testCaseId: string) => `testcase:${testCaseId}`;
type PendingDelete = { kind: "folder" | "test suite"; id: string; name: string; counts: CascadeCounts };

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

// True if `targetId` is `folderId` itself or one of its descendants — used to
// block dropping a folder into one of its own subfolders on the client
// before ever making the request (the server re-checks this too).
function isFolderOrDescendant(folders: Folder[], folderId: string, targetId: string): boolean {
  const childrenByParent = new Map<string, string[]>();
  for (const f of folders) {
    if (!f.parentId) continue;
    const list = childrenByParent.get(f.parentId) ?? [];
    list.push(f.id);
    childrenByParent.set(f.parentId, list);
  }
  const queue = [folderId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (id === targetId) return true;
    queue.push(...(childrenByParent.get(id) ?? []));
  }
  return false;
}

function DraggableTestCaseRow({ testCase, children }: { testCase: TestCase; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: testCaseDragId(testCase.id),
    data: { type: "testcase", testCaseId: testCase.id },
  });
  return (
    <div ref={setNodeRef} className={`flex items-center gap-1 ${isDragging ? "opacity-40" : ""}`}>
      <span {...listeners} {...attributes} className="cursor-grab text-slate-300 dark:text-slate-700 hover:text-slate-500 shrink-0 touch-none" title="Drag to move">
        <GripVertical size={14} />
      </span>
      {children}
    </div>
  );
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
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [draggingLabel, setDraggingLabel] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const stats = useMemo(() => {
    const total = testCases.length;
    const automated = testCases.filter((tc) => tc.testType === "Automated").length;
    const passed = testCases.filter((tc) => tc.latestStatus === "Pass").length;
    const failed = testCases.filter((tc) => tc.latestStatus === "Fail").length;
    return { total, manual: total - automated, automated, passed, failed };
  }, [testCases]);

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
    try {
      await api.delete(`/api/folders/${folder.id}`);
      await loadTree();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const counts = (err.body as { counts?: CascadeCounts })?.counts ?? {};
        setPendingDelete({ kind: "folder", id: folder.id, name: folder.name, counts });
        return;
      }
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
    try {
      await api.delete(`/api/test-suites/${suite.id}`);
      setSuites((prev) => prev.filter((s) => s.id !== suite.id));
      if (selectedSuite?.id === suite.id) navigate("/test-cases");
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const counts = (err.body as { counts?: CascadeCounts })?.counts ?? {};
        setPendingDelete({ kind: "test suite", id: suite.id, name: suite.name, counts });
        return;
      }
      setError(err instanceof ApiError ? err.message : "Could not delete test suite.");
    }
  }

  async function handleConfirmCascadeDelete() {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.kind === "folder") {
        await api.delete(`/api/folders/${pendingDelete.id}?cascade=true`);
        await loadTree();
        if (selectedSuite && !suites.some((s) => s.id === selectedSuite.id)) navigate("/test-cases");
      } else {
        await api.delete(`/api/test-suites/${pendingDelete.id}?cascade=true`);
        setSuites((prev) => prev.filter((s) => s.id !== pendingDelete.id));
        if (selectedSuite?.id === pendingDelete.id) navigate("/test-cases");
      }
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not delete this ${pendingDelete.kind}.`);
      setPendingDelete(null);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as { type: string } | undefined;
    if (data?.type === "testcase") setDraggingLabel("test case");
    else if (data?.type === "suite") setDraggingLabel("test suite");
    else if (data?.type === "folder") setDraggingLabel("folder");
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDraggingLabel(null);
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current as
      | { type: "testcase"; testCaseId: string }
      | { type: "suite"; suiteId: string; folderId: string }
      | { type: "folder"; folderId: string }
      | undefined;
    const overData = over.data.current as
      | { type: "suite"; suiteId: string }
      | { type: "folder"; folderId: string }
      | undefined;
    if (!activeData || !overData) return;

    if (activeData.type === "testcase" && overData.type === "suite") {
      const testCaseId = activeData.testCaseId;
      const targetSuiteId = overData.suiteId;
      const testCase = testCases.find((tc) => tc.id === testCaseId);
      if (!testCase || testCase.testSuiteId === targetSuiteId) return;
      setTestCases((prev) => prev.filter((tc) => tc.id !== testCaseId));
      try {
        await api.patch(`/api/test-cases/${testCaseId}`, { testSuiteId: targetSuiteId });
        setSuites((prev) =>
          prev.map((s) =>
            s.id === targetSuiteId
              ? { ...s, testCaseCount: (s.testCaseCount ?? 0) + 1 }
              : s.id === testCase.testSuiteId
                ? { ...s, testCaseCount: Math.max(0, (s.testCaseCount ?? 1) - 1) }
                : s,
          ),
        );
      } catch (err) {
        setTestCases((prev) => [...prev, testCase]);
        setError(err instanceof ApiError ? err.message : "Could not move the test case.");
      }
      return;
    }

    if (activeData.type === "suite" && overData.type === "folder") {
      const { suiteId, folderId: fromFolderId } = activeData;
      const targetFolderId = overData.folderId;
      if (fromFolderId === targetFolderId) return;
      setSuites((prev) => prev.map((s) => (s.id === suiteId ? { ...s, folderId: targetFolderId } : s)));
      try {
        await api.patch(`/api/test-suites/${suiteId}`, { folderId: targetFolderId });
      } catch (err) {
        setSuites((prev) => prev.map((s) => (s.id === suiteId ? { ...s, folderId: fromFolderId } : s)));
        setError(err instanceof ApiError ? err.message : "Could not move the test suite.");
      }
      return;
    }

    if (activeData.type === "folder" && overData.type === "folder") {
      const folderId = activeData.folderId;
      const targetFolderId = overData.folderId;
      if (folderId === targetFolderId) return;
      const folder = folders.find((f) => f.id === folderId);
      if (!folder || folder.parentId === targetFolderId) return;
      if (isFolderOrDescendant(folders, folderId, targetFolderId)) {
        setError("Can't move a folder into one of its own subfolders.");
        return;
      }
      const previousParentId = folder.parentId;
      setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, parentId: targetFolderId } : f)));
      try {
        await api.patch(`/api/folders/${folderId}`, { parentId: targetFolderId });
      } catch (err) {
        setFolders((prev) => prev.map((f) => (f.id === folderId ? { ...f, parentId: previousParentId } : f)));
        setError(err instanceof ApiError ? err.message : "Could not move the folder.");
      }
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

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
                      className="hover:text-indigo-500 hover:underline"
                      title="Back to Test Repository"
                    >
                      Test Cases
                    </button>
                    <ChevronRight size={11} />
                    {buildBreadcrumb(selectedSuite, folders).map((crumb, i, arr) => (
                      <span key={crumb.key} className="flex items-center gap-1.5">
                        {crumb.clickable ? (
                          <button onClick={() => navigate("/test-cases")} className="hover:text-indigo-500 hover:underline">
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
                  <button onClick={() => setShowImportModal(true)} className={BUTTON_SECONDARY_CLASS}>
                    <Upload size={13} /> Import Test Cases
                  </button>
                  <button onClick={() => navigate(`/test-cases/suite/${selectedSuite.id}/new`)} className={BUTTON_PRIMARY_CLASS}>
                    <Plus size={13} /> Create Test Case
                  </button>
                </div>
              </div>

              {!loadingCases && testCases.length > 0 && (
                <div className="flex flex-wrap gap-2.5">
                  <StatTile label="Total" value={stats.total} icon={ListChecks} tint="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400" />
                  <StatTile label="Manual" value={stats.manual} icon={FlaskConical} tint="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400" />
                  <StatTile label="Automated" value={stats.automated} icon={Bot} tint="bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400" />
                  <StatTile label="Passed (latest)" value={stats.passed} icon={CheckCircle2} tint="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400" />
                  <StatTile label="Failed (latest)" value={stats.failed} icon={XCircle} tint="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400" />
                </div>
              )}

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
                    <DraggableTestCaseRow key={tc.id} testCase={tc}>
                      <button
                        onClick={() => navigate(`/test-cases/case/${tc.id}`)}
                        className="flex-1 min-w-0 flex items-center justify-between gap-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-950/40 rounded-lg px-2 -mx-2 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {tc.code} {tc.name}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {tc.testType === "Automated"
                              ? "Gherkin script"
                              : `${tc.stepCount ?? tc.steps?.length ?? 0} step${(tc.stepCount ?? tc.steps?.length ?? 0) === 1 ? "" : "s"}`}
                            {tc.environment ? ` · ${tc.environment}` : ""}
                            {tc.testPhase ? ` · ${tc.testPhase}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${TEST_CASE_TYPE_BADGE_CLASS[tc.testType]}`}>
                            {tc.testType}
                          </span>
                          {tc.latestStatus && (
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${LATEST_STATUS_BADGE_CLASS[tc.latestStatus]}`}>
                              {LATEST_STATUS_LABELS[tc.latestStatus]}
                            </span>
                          )}
                        </div>
                      </button>
                    </DraggableTestCaseRow>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <DragOverlay>
        {draggingLabel && (
          <div className="text-xs font-medium bg-white dark:bg-slate-900 border border-indigo-500/40 shadow-lg rounded-lg px-3 py-1.5 text-slate-700 dark:text-slate-200">
            Moving {draggingLabel}…
          </div>
        )}
      </DragOverlay>
      </DndContext>

      {pendingDelete && (
        <CascadeDeleteModal
          kind={pendingDelete.kind}
          name={pendingDelete.name}
          counts={pendingDelete.counts}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleConfirmCascadeDelete}
        />
      )}

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
