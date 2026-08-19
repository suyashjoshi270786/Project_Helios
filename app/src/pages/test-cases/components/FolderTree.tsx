import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder as FolderIcon,
  FolderPlus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { Folder, TestSuite } from "../types";
import { INPUT_CLASS } from "../constants";

function InlineCreate({
  placeholder,
  onCreate,
  onCancel,
}: {
  placeholder: string;
  onCreate: (name: string) => void;
  onCancel: () => void;
}) {
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

function InlineRename({
  initialValue,
  onSave,
  onCancel,
}: {
  initialValue: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
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
  onSelectSuite: (suite: TestSuite) => void;
  onCreateFolder: (parentId: string | null, name: string) => void;
  onCreateSuite: (folderId: string, name: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folder: Folder) => void;
  onRenameSuite: (suiteId: string, name: string) => void;
  onDeleteSuite: (suite: TestSuite) => void;
};

function FolderNode({
  folder,
  depth,
  foldersByParent,
  suitesByFolder,
  selectedSuiteId,
  actions,
}: {
  folder: Folder;
  depth: number;
  foldersByParent: Map<string | null, Folder[]>;
  suitesByFolder: Map<string, TestSuite[]>;
  selectedSuiteId: string | null;
  actions: TreeActions;
}) {
  const [expanded, setExpanded] = useState(true);
  const [addingFolder, setAddingFolder] = useState(false);
  const [addingSuite, setAddingSuite] = useState(false);
  const [renamingSuiteId, setRenamingSuiteId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);

  const children = foldersByParent.get(folder.id) ?? [];
  const suites = suitesByFolder.get(folder.id) ?? [];

  return (
    <div>
      <div
        className="group flex items-center gap-1 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
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
          <span
            className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1"
            onClick={() => setExpanded((v) => !v)}
          >
            {folder.name}
          </span>
        )}
        {!renaming && (
          <>
            <button
              onClick={() => setAddingFolder(true)}
              title="New Subfolder"
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-400 shrink-0"
            >
              <FolderPlus size={12} />
            </button>
            <button
              onClick={() => setAddingSuite(true)}
              title="New Test Suite"
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-400 shrink-0"
            >
              <Plus size={12} />
            </button>
            <button
              onClick={() => setRenaming(true)}
              title="Rename"
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-400 shrink-0"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={() => actions.onDeleteFolder(folder)}
              title="Delete Folder"
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 shrink-0 mr-1"
            >
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
          {addingSuite && (
            <div style={{ paddingLeft: (depth + 1) * 14 }}>
              <InlineCreate
                placeholder="Test suite name…"
                onCreate={(name) => {
                  actions.onCreateSuite(folder.id, name);
                  setAddingSuite(false);
                }}
                onCancel={() => setAddingSuite(false)}
              />
            </div>
          )}
          {children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              foldersByParent={foldersByParent}
              suitesByFolder={suitesByFolder}
              selectedSuiteId={selectedSuiteId}
              actions={actions}
            />
          ))}
          {suites.map((suite) => (
            <div
              key={suite.id}
              onClick={() => renamingSuiteId !== suite.id && actions.onSelectSuite(suite)}
              style={{ paddingLeft: (depth + 1) * 14 }}
              className={`group flex items-center gap-1.5 py-1 rounded-lg cursor-pointer text-xs ${
                selectedSuiteId === suite.id
                  ? "bg-blue-600/15 text-blue-500 font-medium"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
              }`}
            >
              <FileText size={13} className="shrink-0" />
              {renamingSuiteId === suite.id ? (
                <InlineRename
                  initialValue={suite.name}
                  onSave={(name) => {
                    actions.onRenameSuite(suite.id, name);
                    setRenamingSuiteId(null);
                  }}
                  onCancel={() => setRenamingSuiteId(null)}
                />
              ) : (
                <>
                  <span className="truncate">{suite.name}</span>
                  {suite.testCaseCount !== undefined && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-600 ml-auto">
                      {suite.testCaseCount}
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingSuiteId(suite.id);
                    }}
                    title="Rename"
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-400 shrink-0"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      actions.onDeleteSuite(suite);
                    }}
                    title="Delete Test Suite"
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 shrink-0 mr-1"
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FolderTree({
  folders,
  suites,
  selectedSuiteId,
  onSelectSuite,
  onCreateFolder,
  onCreateSuite,
  onRenameFolder,
  onDeleteFolder,
  onRenameSuite,
  onDeleteSuite,
}: {
  folders: Folder[];
  suites: TestSuite[];
  selectedSuiteId: string | null;
} & TreeActions) {
  const [addingRootFolder, setAddingRootFolder] = useState(false);

  const actions: TreeActions = {
    onSelectSuite,
    onCreateFolder,
    onCreateSuite,
    onRenameFolder,
    onDeleteFolder,
    onRenameSuite,
    onDeleteSuite,
  };

  const foldersByParent = new Map<string | null, Folder[]>();
  for (const f of folders) {
    const key = f.parentId;
    if (!foldersByParent.has(key)) foldersByParent.set(key, []);
    foldersByParent.get(key)!.push(f);
  }
  const suitesByFolder = new Map<string, TestSuite[]>();
  for (const s of suites) {
    if (!suitesByFolder.has(s.folderId)) suitesByFolder.set(s.folderId, []);
    suitesByFolder.get(s.folderId)!.push(s);
  }

  const rootFolders = foldersByParent.get(null) ?? [];

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] tracking-widest text-slate-400 dark:text-slate-600">TEST REPOSITORY</span>
        <button
          onClick={() => setAddingRootFolder(true)}
          title="New Folder"
          className="text-slate-400 hover:text-blue-400"
        >
          <FolderPlus size={13} />
        </button>
      </div>
      {addingRootFolder && (
        <InlineCreate
          placeholder="Folder name…"
          onCreate={(name) => {
            onCreateFolder(null, name);
            setAddingRootFolder(false);
          }}
          onCancel={() => setAddingRootFolder(false)}
        />
      )}
      {rootFolders.length === 0 && !addingRootFolder && (
        <p className="text-xs text-slate-400 dark:text-slate-500 px-1 py-2">No folders yet.</p>
      )}
      {rootFolders.map((folder) => (
        <FolderNode
          key={folder.id}
          folder={folder}
          depth={0}
          foldersByParent={foldersByParent}
          suitesByFolder={suitesByFolder}
          selectedSuiteId={selectedSuiteId}
          actions={actions}
        />
      ))}
    </div>
  );
}
