import { useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { ChevronDown, ChevronRight, Folder as FolderIcon, FolderPlus, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { INPUT_CLASS } from "../constants";
import MethodBadge from "./MethodBadge";
import type { ApiFolder, ApiRequest } from "../types";

// Adapted from app/src/pages/test-cases/components/FolderTree.tsx — same
// shape (flat arrays grouped into Maps, local per-node expand state,
// dnd-kit draggable+droppable per node with the DndContext owned by the
// parent layout), not imported directly since that component is hardcoded
// to Folder/TestSuite types.

const folderDragId = (folderId: string) => `folder:${folderId}`;
const requestDragId = (requestId: string) => `request:${requestId}`;

function InlineCreate({ placeholder, onCreate, onCancel }: { placeholder: string; onCreate: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex items-center gap-1 py-1">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) onCreate(value.trim());
          if (e.key === "Escape") onCancel();
        }}
        onBlur={() => {
          if (value.trim()) onCreate(value.trim());
          else onCancel();
        }}
        placeholder={placeholder}
        className={INPUT_CLASS + " text-xs py-1"}
      />
    </div>
  );
}

function InlineRename({ initialValue, onSave, onCancel }: { initialValue: string; onSave: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initialValue);
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter" && value.trim()) onSave(value.trim());
        if (e.key === "Escape") onCancel();
      }}
      onBlur={() => {
        if (value.trim() && value.trim() !== initialValue) onSave(value.trim());
        else onCancel();
      }}
      className={INPUT_CLASS + " text-xs py-0.5 flex-1"}
    />
  );
}

type TreeActions = {
  onSelectRequest: (request: ApiRequest) => void;
  onCreateFolder: (parentId: string | null, name: string) => void;
  onCreateRequest: (folderId: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folder: ApiFolder) => void;
  onRenameRequest: (requestId: string, name: string) => void;
  onDeleteRequest: (request: ApiRequest) => void;
  onRunFolder: (folder: ApiFolder) => void;
};

function FolderNode({
  folder,
  depth,
  foldersByParent,
  requestsByFolder,
  selectedRequestId,
  actions,
}: {
  folder: ApiFolder;
  depth: number;
  foldersByParent: Map<string | null, ApiFolder[]>;
  requestsByFolder: Map<string, ApiRequest[]>;
  selectedRequestId: string | null;
  actions: TreeActions;
}) {
  const [expanded, setExpanded] = useState(true);
  const [addingFolder, setAddingFolder] = useState(false);
  const [renamingRequestId, setRenamingRequestId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);

  const children = foldersByParent.get(folder.id) ?? [];
  const requests = requestsByFolder.get(folder.id) ?? [];

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: folderDragId(folder.id),
    data: { type: "folder", folderId: folder.id },
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: folderDragId(folder.id),
    data: { type: "folder", folderId: folder.id },
  });

  return (
    <div>
      <div
        ref={(node) => {
          setDragRef(node);
          setDropRef(node);
        }}
        {...listeners}
        {...attributes}
        className={`group flex items-center gap-1 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer transition-colors ${
          isDragging ? "opacity-40" : ""
        } ${isOver ? "bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/40" : ""}`}
        style={{ paddingLeft: depth * 14 }}
      >
        <button onClick={() => setExpanded((v) => !v)} className="text-slate-400 dark:text-slate-600 shrink-0">
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <FolderIcon size={14} className="text-amber-500 shrink-0" />
        {renaming ? (
          <InlineRename
            initialValue={folder.name}
            onSave={(name) => {
              actions.onRenameFolder(folder.id, name);
              setRenaming(false);
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <span className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1" onClick={() => setExpanded((v) => !v)}>
            {folder.name}
          </span>
        )}
        {!renaming && (
          <>
            <button onClick={() => actions.onRunFolder(folder)} title="Run Collection" className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-500 shrink-0">
              <Play size={12} />
            </button>
            <button onClick={() => setAddingFolder(true)} title="New Subfolder" className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-500 shrink-0">
              <FolderPlus size={12} />
            </button>
            <button onClick={() => actions.onCreateRequest(folder.id)} title="New Request" className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-500 shrink-0">
              <Plus size={12} />
            </button>
            <button onClick={() => setRenaming(true)} title="Rename" className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-500 shrink-0">
              <Pencil size={12} />
            </button>
            <button onClick={() => actions.onDeleteFolder(folder)} title="Delete Folder" className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 shrink-0 mr-1">
              <Trash2 size={12} />
            </button>
          </>
        )}
      </div>

      {expanded && (
        <div>
          {addingFolder && (
            <div style={{ paddingLeft: (depth + 1) * 14 }}>
              <InlineCreate
                placeholder="Subfolder name…"
                onCreate={(name) => {
                  actions.onCreateFolder(folder.id, name);
                  setAddingFolder(false);
                }}
                onCancel={() => setAddingFolder(false)}
              />
            </div>
          )}
          {children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              foldersByParent={foldersByParent}
              requestsByFolder={requestsByFolder}
              selectedRequestId={selectedRequestId}
              actions={actions}
            />
          ))}
          {requests.map((request) => (
            <RequestRow
              key={request.id}
              request={request}
              depth={depth}
              selected={selectedRequestId === request.id}
              renaming={renamingRequestId === request.id}
              onSelect={() => actions.onSelectRequest(request)}
              onStartRename={() => setRenamingRequestId(request.id)}
              onRename={(name) => {
                actions.onRenameRequest(request.id, name);
                setRenamingRequestId(null);
              }}
              onCancelRename={() => setRenamingRequestId(null)}
              onDelete={() => actions.onDeleteRequest(request)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestRow({
  request,
  depth,
  selected,
  renaming,
  onSelect,
  onStartRename,
  onRename,
  onCancelRename,
  onDelete,
}: {
  request: ApiRequest;
  depth: number;
  selected: boolean;
  renaming: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onRename: (name: string) => void;
  onCancelRename: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: requestDragId(request.id),
    data: { type: "request", requestId: request.id, folderId: request.folderId },
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: requestDragId(request.id),
    data: { type: "request", requestId: request.id },
  });

  return (
    <div
      ref={(node) => {
        setDragRef(node);
        setDropRef(node);
      }}
      {...listeners}
      {...attributes}
      onClick={() => !renaming && onSelect()}
      style={{ paddingLeft: (depth + 1) * 14 }}
      className={`group flex items-center gap-1.5 py-1 rounded-lg cursor-pointer text-xs transition-colors ${
        isDragging ? "opacity-40" : ""
      } ${isOver ? "ring-1 ring-inset ring-indigo-500/40 bg-indigo-500/10" : ""} ${
        selected ? "bg-indigo-600/15 text-indigo-600 font-medium" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
      }`}
    >
      <MethodBadge method={request.method} compact />
      {renaming ? (
        <InlineRename initialValue={request.name} onSave={onRename} onCancel={onCancelRename} />
      ) : (
        <>
          <span className="truncate flex-1">{request.name}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStartRename();
            }}
            title="Rename"
            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-500 shrink-0"
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete Request"
            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 shrink-0 mr-1"
          >
            <Trash2 size={12} />
          </button>
        </>
      )}
    </div>
  );
}

export default function ApiCollectionsTree({
  folders,
  requests,
  selectedRequestId,
  ...actions
}: {
  folders: ApiFolder[];
  requests: ApiRequest[];
  selectedRequestId: string | null;
} & TreeActions) {
  const [addingRootFolder, setAddingRootFolder] = useState(false);
  const [renamingUngroupedId, setRenamingUngroupedId] = useState<string | null>(null);

  const foldersByParent = new Map<string | null, ApiFolder[]>();
  for (const f of folders) {
    const key = f.parentId;
    if (!foldersByParent.has(key)) foldersByParent.set(key, []);
    foldersByParent.get(key)!.push(f);
  }
  const requestsByFolder = new Map<string, ApiRequest[]>();
  const ungrouped: ApiRequest[] = [];
  for (const r of requests) {
    if (!r.folderId) {
      ungrouped.push(r);
      continue;
    }
    if (!requestsByFolder.has(r.folderId)) requestsByFolder.set(r.folderId, []);
    requestsByFolder.get(r.folderId)!.push(r);
  }

  const rootFolders = foldersByParent.get(null) ?? [];

  const { setNodeRef: setRootDropRef, isOver: isRootOver } = useDroppable({
    id: "root",
    data: { type: "root" },
  });

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] tracking-widest text-slate-400 dark:text-slate-600">COLLECTIONS</span>
        <button onClick={() => setAddingRootFolder(true)} title="New Folder" className="text-slate-400 hover:text-indigo-500">
          <FolderPlus size={13} />
        </button>
      </div>
      {addingRootFolder && (
        <InlineCreate
          placeholder="Folder name…"
          onCreate={(name) => {
            actions.onCreateFolder(null, name);
            setAddingRootFolder(false);
          }}
          onCancel={() => setAddingRootFolder(false)}
        />
      )}
      {rootFolders.length === 0 && requests.length === 0 && !addingRootFolder && (
        <p className="text-xs text-slate-400 dark:text-slate-500 px-1 py-2">No folders yet.</p>
      )}
      {rootFolders.map((folder) => (
        <FolderNode
          key={folder.id}
          folder={folder}
          depth={0}
          foldersByParent={foldersByParent}
          requestsByFolder={requestsByFolder}
          selectedRequestId={selectedRequestId}
          actions={actions}
        />
      ))}
      {ungrouped.length > 0 && (
        <div ref={setRootDropRef} className={`rounded-lg ${isRootOver ? "bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/40" : ""}`}>
          {ungrouped.map((request) => (
            <RequestRow
              key={request.id}
              request={request}
              depth={0}
              selected={selectedRequestId === request.id}
              renaming={renamingUngroupedId === request.id}
              onSelect={() => actions.onSelectRequest(request)}
              onStartRename={() => setRenamingUngroupedId(request.id)}
              onRename={(name) => {
                actions.onRenameRequest(request.id, name);
                setRenamingUngroupedId(null);
              }}
              onCancelRename={() => setRenamingUngroupedId(null)}
              onDelete={() => actions.onDeleteRequest(request)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
