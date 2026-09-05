import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Plus, Search, Upload, Workflow as WorkflowIcon } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useProject } from "../../projects/ProjectContext";
import ConfirmDeleteModal from "../../components/ConfirmDeleteModal";
import { CARD_CLASS, INPUT_CLASS, BUTTON_SECONDARY_CLASS } from "./constants";
import ApiCollectionsTree from "./components/ApiCollectionsTree";
import EnvironmentSwitcher from "./components/EnvironmentSwitcher";
import EnvironmentsModal from "./components/EnvironmentsModal";
import type { ApiEnvironment, ApiExecution, ApiFolder, ApiRequest } from "./types";

// Keeps a folder if its own name matches, or it (recursively) contains a
// matching request or a matching subfolder — same "surface the whole path to
// a match" behavior as most collection/tree search UIs (Postman included).
function filterCollectionsBySearch(folders: ApiFolder[], requests: ApiRequest[], query: string): { folders: ApiFolder[]; requests: ApiRequest[] } {
  const q = query.trim().toLowerCase();
  if (!q) return { folders, requests };

  const folderById = new Map(folders.map((f) => [f.id, f]));
  const childrenByParent = new Map<string, ApiFolder[]>();
  for (const f of folders) {
    if (!f.parentId) continue;
    const list = childrenByParent.get(f.parentId) ?? [];
    list.push(f);
    childrenByParent.set(f.parentId, list);
  }

  // Folders shown just to give a matched item a visible path to the root.
  const keepFolderIds = new Set<string>();
  function addAncestors(folderId: string | null) {
    let current = folderId ? folderById.get(folderId) : undefined;
    while (current) {
      keepFolderIds.add(current.id);
      current = current.parentId ? folderById.get(current.parentId) : undefined;
    }
  }
  // Folders whose entire contents show, because the folder itself matched.
  const fullyIncludedFolderIds = new Set<string>();
  function addFullyIncluded(folderId: string) {
    fullyIncludedFolderIds.add(folderId);
    keepFolderIds.add(folderId);
    for (const child of childrenByParent.get(folderId) ?? []) addFullyIncluded(child.id);
  }

  const matchedRequests = requests.filter((r) => r.name.toLowerCase().includes(q));
  for (const r of matchedRequests) addAncestors(r.folderId);
  for (const f of folders) {
    if (f.name.toLowerCase().includes(q)) {
      addAncestors(f.id);
      addFullyIncluded(f.id);
    }
  }

  const visibleRequests = requests.filter((r) => matchedRequests.includes(r) || (r.folderId && fullyIncludedFolderIds.has(r.folderId)));
  const visibleFolders = folders.filter((f) => keepFolderIds.has(f.id));
  return { folders: visibleFolders, requests: visibleRequests };
}

function environmentStorageKey(projectId: string) {
  return `heliosqe:api-studio:environment:${projectId}`;
}

// True if `targetId` is `folderId` itself or one of its descendants — blocks
// dropping a folder into one of its own subfolders on the client before
// making the request (the server re-checks this too). Same shape as
// TestCasesPage.tsx's isFolderOrDescendant.
function isFolderOrDescendant(folders: ApiFolder[], folderId: string, targetId: string): boolean {
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

type PendingDelete = { kind: "folder" | "request"; id: string; name: string; message: string };

export type ApiStudioOutletContext = {
  reloadTree: () => Promise<void>;
  onRequestSaved: (updated: ApiRequest) => void;
  onRequestDeleted: (deletedId: string) => void;
  selectedEnvironmentId: string | null;
};

export default function ApiStudioLayout() {
  const { currentProjectId, currentProject, loading: projectLoading } = useProject();
  const navigate = useNavigate();
  const location = useLocation();
  const { requestId } = useParams<{ requestId?: string }>();

  const [folders, setFolders] = useState<ApiFolder[]>([]);
  const [requests, setRequests] = useState<ApiRequest[]>([]);
  const [environments, setEnvironments] = useState<ApiEnvironment[]>([]);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | null>(null);
  const [showEnvironmentsModal, setShowEnvironmentsModal] = useState(false);
  const [loadingTree, setLoadingTree] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const onWorkflowsRoute = location.pathname.startsWith("/api-studio/workflows");
  const { folders: visibleFolders, requests: visibleRequests } = filterCollectionsBySearch(folders, requests, search);

  useEffect(() => {
    if (!currentProjectId) {
      setLoadingTree(false);
      return;
    }
    loadTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProjectId]);

  async function loadTree() {
    setLoadingTree(true);
    setError("");
    try {
      const [folderList, requestList, environmentList] = await Promise.all([
        api.get<ApiFolder[]>(`/api/api-studio/folders?projectId=${currentProjectId}`),
        api.get<ApiRequest[]>(`/api/api-studio/requests?projectId=${currentProjectId}`),
        api.get<ApiEnvironment[]>(`/api/api-studio/environments?projectId=${currentProjectId}`),
      ]);
      setFolders(folderList);
      setRequests(requestList);
      setEnvironments(environmentList);

      // Per-viewer convenience only (which environment id is selected) —
      // never anything secret. Restore the prior selection for this project
      // if it still exists, else fall back to none.
      let stored: string | null = null;
      try {
        stored = currentProjectId ? localStorage.getItem(environmentStorageKey(currentProjectId)) : null;
      } catch {
        // Storage can throw in some private-browsing contexts — fine to just skip restoring.
      }
      setSelectedEnvironmentId(stored && environmentList.some((e) => e.id === stored) ? stored : null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load API Studio.");
    } finally {
      setLoadingTree(false);
    }
  }

  function handleSelectEnvironment(environmentId: string | null) {
    setSelectedEnvironmentId(environmentId);
    try {
      if (currentProjectId) {
        if (environmentId) localStorage.setItem(environmentStorageKey(currentProjectId), environmentId);
        else localStorage.removeItem(environmentStorageKey(currentProjectId));
      }
    } catch {
      // Non-fatal — the selection just won't survive a reload.
    }
  }

  async function handleCreateFolder(parentId: string | null, name: string) {
    try {
      const folder = await api.post<ApiFolder>("/api/api-studio/folders", { projectId: currentProjectId, name, parentId });
      setFolders((prev) => [...prev, folder]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create folder.");
    }
  }

  function handleCreateRequest(folderId: string) {
    navigate(`/api-studio/new?folderId=${folderId}`);
  }

  async function handleRenameFolder(folderId: string, name: string) {
    try {
      const updated = await api.patch<ApiFolder>(`/api/api-studio/folders/${folderId}`, { name });
      setFolders((prev) => prev.map((f) => (f.id === folderId ? updated : f)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not rename folder.");
    }
  }

  async function handleDeleteFolder(folder: ApiFolder) {
    try {
      await api.delete(`/api/api-studio/folders/${folder.id}`);
      await loadTree();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const counts = (err.body as { counts?: { subfolders?: number; requests?: number } })?.counts ?? {};
        const parts: string[] = [];
        if (counts.subfolders) parts.push(`${counts.subfolders} subfolder${counts.subfolders === 1 ? "" : "s"}`);
        if (counts.requests) parts.push(`${counts.requests} request${counts.requests === 1 ? "" : "s"}`);
        setPendingDelete({
          kind: "folder",
          id: folder.id,
          name: folder.name,
          message: `"${folder.name}" contains ${parts.join(" and ") || "items"}. Deleting it removes all of that permanently — this cannot be undone.`,
        });
        return;
      }
      setError(err instanceof ApiError ? err.message : "Could not delete folder.");
    }
  }

  async function handleRenameRequest(requestId: string, name: string) {
    try {
      const updated = await api.patch<ApiRequest>(`/api/api-studio/requests/${requestId}`, { name });
      setRequests((prev) => prev.map((r) => (r.id === requestId ? updated : r)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not rename request.");
    }
  }

  async function handleDeleteRequest(request: ApiRequest) {
    setPendingDelete({ kind: "request", id: request.id, name: request.name, message: `This permanently deletes "${request.name}" and its execution history. This cannot be undone.` });
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.kind === "folder") {
        await api.delete(`/api/api-studio/folders/${pendingDelete.id}?cascade=true`);
        await loadTree();
      } else {
        await api.delete(`/api/api-studio/requests/${pendingDelete.id}`);
        setRequests((prev) => prev.filter((r) => r.id !== pendingDelete.id));
      }
      if (requestId === pendingDelete.id) navigate("/api-studio");
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Could not delete this ${pendingDelete.kind}.`);
      setPendingDelete(null);
    }
  }

  async function handleRunFolder(folder: ApiFolder) {
    setInfo("");
    setError("");
    try {
      const executions = await api.post<ApiExecution[]>(`/api/api-studio/folders/${folder.id}/run`, { environmentId: selectedEnvironmentId });
      const passed = executions.filter((e) => e.status === "Success").length;
      setInfo(`Ran ${executions.length} request(s) in "${folder.name}" — ${passed} succeeded.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not run this collection.");
    }
  }

  async function handleDuplicateFolder(folder: ApiFolder) {
    setError("");
    try {
      await api.post(`/api/api-studio/folders/${folder.id}/duplicate`);
      await loadTree();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not duplicate this folder.");
    }
  }

  async function handleImportClick() {
    importInputRef.current?.click();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !currentProjectId) return;

    setImporting(true);
    setError("");
    setInfo("");
    try {
      const text = await file.text();
      const collection = JSON.parse(text);
      const result = await api.post<{ foldersCreated: number; requestsCreated: number; warnings: string[] }>("/api/api-studio/import/postman", {
        projectId: currentProjectId,
        collection,
      });
      await loadTree();
      const warningNote = result.warnings.length > 0 ? ` (${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"} — see below)` : "";
      setInfo(`Imported ${result.foldersCreated} folder(s) and ${result.requestsCreated} request(s)${warningNote}.`);
      if (result.warnings.length > 0) setError(result.warnings.join(" "));
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError("That file isn't valid JSON — export it as a Postman Collection v2.1 file and try again.");
      } else {
        setError(err instanceof ApiError ? err.message : "Could not import this collection.");
      }
    } finally {
      setImporting(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current as
      | { type: "folder"; folderId: string }
      | { type: "request"; requestId: string; folderId: string | null }
      | undefined;
    const overData = over.data.current as { type: "folder"; folderId: string } | { type: "root" } | undefined;
    if (!activeData || !overData) return;

    if (activeData.type === "request") {
      const { requestId: draggedId, folderId: fromFolderId } = activeData;
      const targetFolderId = overData.type === "root" ? null : overData.folderId;
      if (fromFolderId === targetFolderId) return;
      setRequests((prev) => prev.map((r) => (r.id === draggedId ? { ...r, folderId: targetFolderId } : r)));
      try {
        await api.patch(`/api/api-studio/requests/${draggedId}`, { folderId: targetFolderId });
      } catch (err) {
        setRequests((prev) => prev.map((r) => (r.id === draggedId ? { ...r, folderId: fromFolderId } : r)));
        setError(err instanceof ApiError ? err.message : "Could not move the request.");
      }
      return;
    }

    if (activeData.type === "folder") {
      const draggedFolderId = activeData.folderId;
      const targetFolderId = overData.type === "root" ? null : overData.folderId;
      const folder = folders.find((f) => f.id === draggedFolderId);
      if (!folder || folder.parentId === targetFolderId) return;
      if (targetFolderId && isFolderOrDescendant(folders, draggedFolderId, targetFolderId)) {
        setError("Can't move a folder into one of its own subfolders.");
        return;
      }
      const previousParentId = folder.parentId;
      setFolders((prev) => prev.map((f) => (f.id === draggedFolderId ? { ...f, parentId: targetFolderId } : f)));
      try {
        await api.patch(`/api/api-studio/folders/${draggedFolderId}`, { parentId: targetFolderId });
      } catch (err) {
        setFolders((prev) => prev.map((f) => (f.id === draggedFolderId ? { ...f, parentId: previousParentId } : f)));
        setError(err instanceof ApiError ? err.message : "Could not move the folder.");
      }
    }
  }

  if (!projectLoading && !currentProjectId) {
    return (
      <div className="space-y-5">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">API Studio</h1>
        <div className={CARD_CLASS + " text-center text-sm text-slate-400 dark:text-slate-500"}>
          Create a project first — API Studio requests live inside a project.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">API Studio</h1>
          {currentProject && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Project: {currentProject.name}</p>}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 text-xs">
            <button
              onClick={() => navigate("/api-studio")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${!onWorkflowsRoute ? "bg-indigo-600 text-white" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
            >
              Requests
            </button>
            <button
              onClick={() => navigate("/api-studio/workflows")}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md font-medium transition-colors ${onWorkflowsRoute ? "bg-indigo-600 text-white" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"}`}
            >
              <WorkflowIcon size={12} /> Workflows
            </button>
          </div>
          <EnvironmentSwitcher
            environments={environments}
            selectedEnvironmentId={selectedEnvironmentId}
            onSelect={handleSelectEnvironment}
            onManage={() => setShowEnvironmentsModal(true)}
          />
          <input ref={importInputRef} type="file" accept=".json,.postman_collection" className="hidden" onChange={handleImportFile} />
          <button onClick={handleImportClick} disabled={importing} className={BUTTON_SECONDARY_CLASS}>
            <Upload size={13} /> {importing ? "Importing…" : "Import Collection"}
          </button>
          <button
            onClick={() => navigate("/api-studio/new")}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
          >
            <Plus size={13} /> New Request
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
      {info && <p className="text-xs text-emerald-600 dark:text-emerald-400">{info}</p>}

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 items-start">
          <div className={CARD_CLASS}>
            <div className="relative mb-2">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search collections…"
                className={INPUT_CLASS + " pl-7 py-1.5 text-xs"}
              />
            </div>
            {loadingTree ? (
              <p className="text-xs text-slate-400 dark:text-slate-500">Loading…</p>
            ) : (
              <ApiCollectionsTree
                folders={visibleFolders}
                requests={visibleRequests}
                selectedRequestId={requestId ?? null}
                onSelectRequest={(request) => navigate(`/api-studio/${request.id}`)}
                onCreateFolder={handleCreateFolder}
                onCreateRequest={handleCreateRequest}
                onRenameFolder={handleRenameFolder}
                onDeleteFolder={handleDeleteFolder}
                onRenameRequest={handleRenameRequest}
                onDeleteRequest={handleDeleteRequest}
                onRunFolder={handleRunFolder}
                onDuplicateFolder={handleDuplicateFolder}
              />
            )}
          </div>

          <div className={CARD_CLASS}>
            <Outlet
              context={{
                reloadTree: loadTree,
                onRequestSaved: (updated: ApiRequest) => setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r))),
                onRequestDeleted: (deletedId: string) => {
                  setRequests((prev) => prev.filter((r) => r.id !== deletedId));
                  navigate("/api-studio");
                },
                selectedEnvironmentId,
              }}
            />
          </div>
        </div>
      </DndContext>

      {pendingDelete && (
        <ConfirmDeleteModal
          title={`Delete ${pendingDelete.kind === "folder" ? "Folder" : "Request"}`}
          message={pendingDelete.message}
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {showEnvironmentsModal && currentProjectId && (
        <EnvironmentsModal
          projectId={currentProjectId}
          environments={environments}
          onClose={() => setShowEnvironmentsModal(false)}
          onReload={async () => {
            const list = await api.get<ApiEnvironment[]>(`/api/api-studio/environments?projectId=${currentProjectId}`);
            setEnvironments(list);
          }}
        />
      )}
    </div>
  );
}
