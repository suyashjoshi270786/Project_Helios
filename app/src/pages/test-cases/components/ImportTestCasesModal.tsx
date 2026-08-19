import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Upload, X } from "lucide-react";
import { api, ApiError } from "../../../lib/api";
import { SELECT_CLASS } from "../constants";

type ImportedStep = { description: string; testData?: string; expectedResult: string };
type ImportCandidate = {
  name: string;
  objective?: string;
  preconditions?: string;
  environment?: string;
  testPhase?: string;
  testType: "Manual" | "Automated";
  steps: ImportedStep[];
};
type RowIssue = { row: number; message: string };
type ImportPreview = {
  totalRows: number;
  candidates: ImportCandidate[];
  errors: RowIssue[];
  warnings: RowIssue[];
};

type MappableField =
  | "name"
  | "description"
  | "expectedResult"
  | "step"
  | "objective"
  | "preconditions"
  | "environment"
  | "testPhase"
  | "testType"
  | "testData";

type Mapping = Partial<Record<MappableField, string | null>>;

const FIELD_DEFS: { key: MappableField; label: string; required: boolean }[] = [
  { key: "name", label: "Test Case Name", required: true },
  { key: "description", label: "Test Description", required: true },
  { key: "expectedResult", label: "Expected Result", required: true },
  { key: "step", label: "Step (number)", required: false },
  { key: "objective", label: "Test Objective", required: false },
  { key: "preconditions", label: "Precondition", required: false },
  { key: "environment", label: "Test Environment", required: false },
  { key: "testPhase", label: "Test Phase", required: false },
  { key: "testType", label: "Test Type", required: false },
  { key: "testData", label: "Test Data", required: false },
];

type Stage = "select" | "map" | "preview" | "done";

export default function ImportTestCasesModal({
  projectId,
  testSuiteId,
  onClose,
  onImported,
}: {
  projectId: string;
  testSuiteId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("select");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [totalRows, setTotalRows] = useState(0);

  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [validating, setValidating] = useState(false);
  const [validateError, setValidateError] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const missingRequired = FIELD_DEFS.filter((f) => f.required && !mapping[f.key]);

  async function handleUpload() {
    if (!file) return;
    setParsing(true);
    setParseError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("projectId", projectId);
      form.set("testSuiteId", testSuiteId);
      const result = await api.post<{
        headers: string[];
        rows: Record<string, string>[];
        totalRows: number;
        guessedMapping: Mapping;
      }>("/api/test-cases/import/parse", form, 30000);
      setHeaders(result.headers);
      setRows(result.rows);
      setTotalRows(result.totalRows);
      setMapping(result.guessedMapping);
      setStage("map");
    } catch (err) {
      setParseError(err instanceof ApiError ? err.message : "Could not read this CSV file.");
    } finally {
      setParsing(false);
    }
  }

  async function handlePreview() {
    setValidating(true);
    setValidateError("");
    try {
      const result = await api.post<ImportPreview>("/api/test-cases/import/validate", {
        projectId,
        testSuiteId,
        rows,
        mapping,
      });
      setPreview(result);
      setStage("preview");
    } catch (err) {
      setValidateError(err instanceof ApiError ? err.message : "Could not validate these rows.");
    } finally {
      setValidating(false);
    }
  }

  async function handleImport() {
    if (!preview || preview.candidates.length === 0) return;
    setImporting(true);
    setImportError("");
    try {
      const { imported } = await api.post<{ imported: number }>("/api/test-cases/import", {
        projectId,
        testSuiteId,
        testCases: preview.candidates,
      });
      setImportedCount(imported);
      setStage("done");
      onImported();
    } catch (err) {
      setImportError(err instanceof ApiError ? err.message : "Could not import these test cases.");
    } finally {
      setImporting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <h2 className="text-sm font-medium text-slate-900 dark:text-white">Import Test Cases</h2>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {stage === "select" && (
            <>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Upload a UTF-8 CSV. You'll map its columns to Test Case fields on the next step.
              </p>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                  id="csv-import-input"
                />
                <label
                  htmlFor="csv-import-input"
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded-lg px-3 py-1.5 cursor-pointer transition-colors"
                >
                  <Upload size={12} /> Select CSV
                </label>
                {file && <span className="text-xs text-slate-600 dark:text-slate-300">{file.name}</span>}
              </div>
              {parseError && <p className="text-xs text-red-500 dark:text-red-400">{parseError}</p>}
            </>
          )}

          {stage === "map" && (
            <>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {totalRows} row{totalRows === 1 ? "" : "s"} found. Map each field to a column from your CSV —
                we've guessed where we could, but review and adjust before previewing.
              </p>
              <div className="space-y-2">
                {FIELD_DEFS.map((f) => (
                  <div key={f.key} className="grid grid-cols-2 gap-3 items-center">
                    <label className="text-xs text-slate-600 dark:text-slate-300">
                      {f.label} {f.required && <span className="text-red-500">*</span>}
                    </label>
                    <select
                      value={mapping[f.key] ?? ""}
                      onChange={(e) => setMapping((prev) => ({ ...prev, [f.key]: e.target.value || null }))}
                      className={SELECT_CLASS + " text-xs py-1.5"}
                    >
                      <option value="">— Not mapped —</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {validateError && <p className="text-xs text-red-500 dark:text-red-400">{validateError}</p>}
            </>
          )}

          {stage === "preview" && preview && (
            <>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-lg font-semibold text-slate-900 dark:text-white">{preview.totalRows}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">Total Rows</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-emerald-500">{preview.candidates.length}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">Valid</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-amber-500">{preview.warnings.length}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">Warnings</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-red-500">{preview.errors.length}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">Errors</div>
                </div>
              </div>

              {(preview.errors.length > 0 || preview.warnings.length > 0) && (
                <div className="max-h-40 overflow-y-auto space-y-1 border border-slate-200 dark:border-slate-800 rounded-lg p-2">
                  {preview.errors.map((e, i) => (
                    <div key={`e${i}`} className="flex items-start gap-1.5 text-xs text-red-500 dark:text-red-400">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      Row {e.row}: {e.message}
                    </div>
                  ))}
                  {preview.warnings.map((w, i) => (
                    <div key={`w${i}`} className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                      Row {w.row}: {w.message}
                    </div>
                  ))}
                </div>
              )}
              {importError && <p className="text-xs text-red-500 dark:text-red-400">{importError}</p>}
            </>
          )}

          {stage === "done" && importedCount !== null && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 size={24} className="text-emerald-500" />
              <p className="text-sm text-slate-700 dark:text-slate-200">
                Imported {importedCount} test case{importedCount === 1 ? "" : "s"}.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <div>
            {stage === "map" && (
              <button
                onClick={() => setStage("select")}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <ArrowLeft size={13} /> Back
              </button>
            )}
            {stage === "preview" && (
              <button
                onClick={() => setStage("map")}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <ArrowLeft size={13} /> Back to Mapping
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {stage === "done" ? (
              <button
                onClick={onClose}
                className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
              >
                Done
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs font-medium rounded-lg px-3.5 py-2"
                >
                  Cancel
                </button>
                {stage === "select" && (
                  <button
                    onClick={handleUpload}
                    disabled={!file || parsing}
                    className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
                  >
                    {parsing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    Upload
                  </button>
                )}
                {stage === "map" && (
                  <button
                    onClick={handlePreview}
                    disabled={validating || missingRequired.length > 0}
                    title={
                      missingRequired.length > 0
                        ? `Map: ${missingRequired.map((f) => f.label).join(", ")}`
                        : undefined
                    }
                    className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
                  >
                    {validating ? <Loader2 size={13} className="animate-spin" /> : null}
                    Preview
                  </button>
                )}
                {stage === "preview" && (
                  <button
                    onClick={handleImport}
                    disabled={importing || !preview || preview.candidates.length === 0}
                    title={preview && preview.candidates.length === 0 ? "No valid rows to import." : undefined}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white text-xs font-medium rounded-lg px-3.5 py-2"
                  >
                    {importing ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    Import Valid Records ({preview?.candidates.length ?? 0})
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
