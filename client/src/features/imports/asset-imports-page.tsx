import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { authErrorMessage } from "../auth/auth-errors";
import { protectedQueryKey, useAuthStore } from "../auth/auth-store";
import { canManageAssetRegister } from "../assets/asset-access";
import {
  assetImportsApi,
  type AssetImportJob,
  type AssetImportSampleRow,
} from "./asset-imports-api";

const maxFileBytes = 1_048_576;
const pageSize = 20;
const templateHeader =
  "assetTag,categoryCode,locationCode,availability,condition,criticality,manufacturer,model,serialNumber,sourceReference,notes,specifications,purchaseDate,warrantyExpiresOn,warrantyReference";
async function fileChecksum(file: File): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function formatImportDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function AssetImportsPage() {
  const role = useAuthStore((state) => state.session?.user.role);
  const generation = useAuthStore((state) => state.generation);
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/imports" });
  const { jobId } = useSearch({ from: "/imports" });
  const [page, setPage] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [sampleRows, setSampleRows] = useState<AssetImportSampleRow[]>([]);
  const [previewAttempt, setPreviewAttempt] = useState<{
    fingerprint: string;
    key: string;
  } | null>(null);
  const [commitAttempt, setCommitAttempt] = useState<{
    fingerprint: string;
    key: string;
  } | null>(null);
  const [commitConfirmed, setCommitConfirmed] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);

  const jobsQuery = useQuery({
    queryKey: protectedQueryKey("asset-imports", page),
    queryFn: () => assetImportsApi.list(page, pageSize),
    enabled: canManageAssetRegister(role),
  });
  const selectedJobQuery = useQuery({
    queryKey: protectedQueryKey("asset-import-job", jobId),
    queryFn: () => assetImportsApi.get(jobId!),
    enabled: canManageAssetRegister(role) && Boolean(jobId),
  });
  const errorsQuery = useQuery({
    queryKey: protectedQueryKey("asset-import-errors", jobId),
    queryFn: () => assetImportsApi.errors(jobId!),
    enabled:
      canManageAssetRegister(role) &&
      Boolean(jobId) &&
      selectedJobQuery.data?.status === "FAILED",
  });
  const selectedJob: AssetImportJob | undefined = selectedJobQuery.data;

  const invalidateImports = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: protectedQueryKey("asset-imports"),
      }),
      queryClient.invalidateQueries({
        queryKey: protectedQueryKey("asset-import-job", jobId),
      }),
      queryClient.invalidateQueries({
        queryKey: protectedQueryKey("asset-import-errors", jobId),
      }),
    ]);
  };
  const previewImport = useMutation({
    mutationFn: ({ selectedFile, key }: { selectedFile: File; key: string }) =>
      assetImportsApi.preview(selectedFile, key, (event) => {
        setUploadProgress(
          event.total ? Math.round((event.loaded / event.total) * 100) : null,
        );
      }),
    onSuccess: async (result) => {
      if (useAuthStore.getState().generation !== generation) return;
      setUploadProgress(null);
      setSampleRows(result.sampleRows);
      setCommitAttempt(null);
      setCommitConfirmed(false);
      setMessageIsError(result.job.status === "FAILED");
      setMessage(
        result.job.status === "FAILED"
          ? `Preview failed with ${result.job.errorCount} row or file error(s). No assets were created.`
          : `Preview ready: ${result.job.validRows} asset row(s) passed validation.`,
      );
      await navigate({ search: { jobId: result.job.id } });
      await invalidateImports();
    },
    onError: (error) => {
      setUploadProgress(null);
      setMessageIsError(true);
      setMessage(authErrorMessage(error));
    },
  });
  const commitImport = useMutation({
    mutationFn: ({
      selectedFile,
      selectedJob,
      key,
    }: {
      selectedFile: File;
      selectedJob: AssetImportJob;
      key: string;
    }) =>
      assetImportsApi.commit(
        selectedJob.id,
        selectedJob.version,
        selectedFile,
        key,
        (event) => {
          setUploadProgress(
            event.total ? Math.round((event.loaded / event.total) * 100) : null,
          );
        },
      ),
    onSuccess: async (result) => {
      if (useAuthStore.getState().generation !== generation) return;
      setUploadProgress(null);
      setCommitAttempt(null);
      setCommitConfirmed(false);
      setMessageIsError(result.job.status !== "COMMITTED");
      setMessage(
        result.job.status === "COMMITTED"
          ? `${result.job.createdCount} asset(s) were committed atomically.`
          : `Commit failed with ${result.job.errorCount} error(s). No partial assets were committed.`,
      );
      await Promise.all([
        invalidateImports(),
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("assets"),
        }),
      ]);
    },
    onError: (error) => {
      setUploadProgress(null);
      setMessageIsError(true);
      setMessage(authErrorMessage(error));
    },
  });

  if (!canManageAssetRegister(role)) {
    return (
      <section>
        <div className="page-heading">
          <p className="eyebrow">Hardware</p>
          <h1>Asset imports</h1>
          <p className="page-description">
            Asset import is available to Asset Managers within their assigned
            location scope.
          </p>
        </div>
        <p className="form-error" role="alert">
          Asset Manager access is required.
        </p>
      </section>
    );
  }

  const validateSelectedFile = (selectedFile: File | null) => {
    if (!selectedFile) return "Choose a CSV file.";
    if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
      return "Only .csv files are supported.";
    }
    if (selectedFile.size <= 0 || selectedFile.size > maxFileBytes) {
      return "CSV must be between 1 byte and 1 MiB.";
    }
    return null;
  };

  const submitPreview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    const fileError = validateSelectedFile(file);
    if (fileError || !file) {
      setMessageIsError(true);
      setMessage(fileError);
      return;
    }
    try {
      const fingerprint = await fileChecksum(file);
      const key =
        previewAttempt?.fingerprint === fingerprint
          ? previewAttempt.key
          : crypto.randomUUID();
      setPreviewAttempt({ fingerprint, key });
      setUploadProgress(0);
      previewImport.mutate({ selectedFile: file, key });
    } catch (error) {
      setMessageIsError(true);
      setMessage(
        `Could not read the selected file. ${authErrorMessage(error)}`,
      );
    }
  };

  const submitCommit = async () => {
    setMessage(null);
    if (!selectedJob || selectedJob.status !== "PREVIEW_READY") return;
    if (!commitConfirmed) {
      setMessageIsError(true);
      setMessage("Confirm that the validated rows should be committed.");
      return;
    }
    const fileError = validateSelectedFile(file);
    if (fileError || !file) {
      setMessageIsError(true);
      setMessage("Re-select the original CSV file to commit this preview.");
      return;
    }
    try {
      const checksum = await fileChecksum(file);
      if (checksum !== selectedJob.fileChecksum) {
        setMessageIsError(true);
        setMessage("Selected CSV does not match the previewed file.");
        return;
      }
      const fingerprint = `${selectedJob.id}:${checksum}`;
      const key =
        commitAttempt?.fingerprint === fingerprint
          ? commitAttempt.key
          : crypto.randomUUID();
      setCommitAttempt({ fingerprint, key });
      setUploadProgress(0);
      commitImport.mutate({ selectedFile: file, selectedJob, key });
    } catch (error) {
      setMessageIsError(true);
      setMessage(
        `Could not verify the selected file. ${authErrorMessage(error)}`,
      );
    }
  };

  const templateUri = `data:text/csv;charset=utf-8,${encodeURIComponent(`${templateHeader}\r\n`)}`;

  return (
    <section className="asset-imports-page">
      <div className="page-heading">
        <p className="eyebrow">Hardware · Data operations</p>
        <h1>Asset imports</h1>
        <p className="page-description">
          Preview a UTF-8 CSV, review every validation error, then explicitly
          commit all rows in one transaction. The uploaded file is never stored
          on the server.
        </p>
        <Link
          className="button button-secondary"
          search={{
            page: 1,
            search: "",
            locationId: "",
            categoryId: "",
            lifecycle: "",
            availability: "",
            condition: "",
            verification: "",
            warrantyExpiresOnFrom: "",
            warrantyExpiresOnTo: "",
          }}
          to="/assets"
        >
          Open Asset Register
        </Link>
      </div>

      {message && (
        <p
          className={messageIsError ? "form-error" : "form-notice"}
          role={messageIsError ? "alert" : "status"}
        >
          {message}
        </p>
      )}

      <section className="user-admin-card modern-form-card">
        <div className="form-card-heading">
          <span className="form-step-mark" aria-hidden="true">
            01
          </span>
          <div>
            <p className="eyebrow">Secure CSV workflow</p>
            <h2>Upload and preview</h2>
            <p>
              CSV only · 1 MiB maximum · 2,000 data rows · no raw file retention
            </p>
          </div>
        </div>
        <div className="asset-import-template">
          <p>
            Required columns: <code>assetTag</code>, <code>categoryCode</code>,{" "}
            <code>locationCode</code>, <code>availability</code>, and{" "}
            <code>condition</code>. Optional columns: manufacturer, model,
            criticality, serialNumber, sourceReference, notes, and{" "}
            <code>specifications</code>
            as a JSON object of the category's string fields, purchaseDate,
            warrantyExpiresOn, and warrantyReference. Dates use YYYY-MM-DD.
          </p>
          <a
            className="button button-secondary"
            download="asset-import-template.csv"
            href={templateUri}
          >
            Download CSV template
          </a>
        </div>
        <form className="asset-import-upload" onSubmit={submitPreview}>
          <label className="modern-field">
            <span>CSV file</span>
            <input
              accept=".csv,text/csv"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreviewAttempt(null);
                setCommitAttempt(null);
                setCommitConfirmed(false);
                setSampleRows([]);
              }}
              type="file"
            />
          </label>
          {file && (
            <p className="asset-import-file-info">
              {file.name} · {(file.size / 1024).toFixed(1)} KiB
            </p>
          )}
          {uploadProgress !== null && (
            <progress
              aria-label="CSV upload progress"
              max={100}
              value={uploadProgress}
            />
          )}
          <div className="modern-form-actions master-live-form-actions">
            <div>
              <strong>Asset Manager command</strong>
              <small>
                Only checksum, job status, counts, and row errors are retained.
                Source bytes and row values are not stored.
              </small>
            </div>
            <button
              className="button"
              disabled={previewImport.isPending || !file}
              type="submit"
            >
              {previewImport.isPending ? "Validating…" : "Upload and preview"}
            </button>
          </div>
        </form>
      </section>

      {(sampleRows.length > 0 || selectedJob) && (
        <section className="user-admin-card">
          <div className="asset-import-heading">
            <div>
              <p className="eyebrow">Import job</p>
              <h2>
                {selectedJob
                  ? `Job ${selectedJob.id.slice(0, 8).toUpperCase()}`
                  : "Current preview"}
              </h2>
            </div>
            {selectedJob && (
              <span
                className={`asset-import-status ${selectedJob.status.toLowerCase()}`}
              >
                {selectedJob.status.replaceAll("_", " ")}
              </span>
            )}
          </div>
          {selectedJobQuery.isError && (
            <p className="form-error" role="alert">
              {authErrorMessage(selectedJobQuery.error)}
            </p>
          )}
          {selectedJob && (
            <dl className="asset-import-summary">
              <div>
                <dt>Total rows</dt>
                <dd>{selectedJob.totalRows}</dd>
              </div>
              <div>
                <dt>Valid rows</dt>
                <dd>{selectedJob.validRows}</dd>
              </div>
              <div>
                <dt>Errors</dt>
                <dd>{selectedJob.errorCount}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{selectedJob.createdCount}</dd>
              </div>
              <div>
                <dt>Version</dt>
                <dd>{selectedJob.version}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{formatImportDate(selectedJob.createdAt)}</dd>
              </div>
            </dl>
          )}
          {sampleRows.length > 0 && (
            <div className="user-table-scroll">
              <table className="user-table">
                <thead>
                  <tr>
                    <th scope="col">CSV row</th>
                    <th scope="col">Asset tag</th>
                    <th scope="col">Category</th>
                    <th scope="col">Location</th>
                    <th scope="col">Availability</th>
                    <th scope="col">Condition</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleRows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td>{row.assetTag}</td>
                      <td>{row.categoryCode}</td>
                      <td>{row.locationCode}</td>
                      <td>{row.availability}</td>
                      <td>{row.condition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <small>
                Showing up to five sample rows; full row values are not
                retained.
              </small>
            </div>
          )}
          {selectedJob?.status === "PREVIEW_READY" && (
            <div className="asset-import-commit">
              <p>
                Re-select the exact same CSV after a page reload. The server
                checks its checksum again before committing.
              </p>
              <label className="asset-import-confirm">
                <input
                  checked={commitConfirmed}
                  onChange={(event) => setCommitConfirmed(event.target.checked)}
                  type="checkbox"
                />
                I confirm all validated assets should be committed atomically.
              </label>
              <button
                className="button"
                disabled={
                  commitImport.isPending || !file || selectedJob.errorCount > 0
                }
                onClick={() => void submitCommit()}
                type="button"
              >
                {commitImport.isPending
                  ? "Committing…"
                  : "Confirm and commit all rows"}
              </button>
            </div>
          )}
          {errorsQuery.data?.length ? (
            <div className="user-table-scroll">
              <table className="user-table">
                <thead>
                  <tr>
                    <th scope="col">Row</th>
                    <th scope="col">Field</th>
                    <th scope="col">Issue</th>
                  </tr>
                </thead>
                <tbody>
                  {errorsQuery.data.map((error, index) => (
                    <tr
                      key={
                        error.id ??
                        `${error.rowNumber}:${error.fieldName}:${index}`
                      }
                    >
                      <td>{error.rowNumber}</td>
                      <td>{error.fieldName}</td>
                      <td>{error.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      )}

      <section className="user-admin-card">
        <div className="asset-import-heading">
          <div>
            <p className="eyebrow">History</p>
            <h2>Recent import jobs</h2>
          </div>
          {jobsQuery.data && (
            <span className="master-live-total">
              {jobsQuery.data.total} jobs
            </span>
          )}
        </div>
        {jobsQuery.isError && (
          <p className="form-error" role="alert">
            {authErrorMessage(jobsQuery.error)}
          </p>
        )}
        {jobsQuery.isPending ? (
          <p className="master-live-state" role="status">
            Loading import jobs…
          </p>
        ) : jobsQuery.data?.items.length ? (
          <div className="user-table-scroll">
            <table className="user-table">
              <thead>
                <tr>
                  <th scope="col">Job</th>
                  <th scope="col">Status</th>
                  <th scope="col">Rows</th>
                  <th scope="col">Errors</th>
                  <th scope="col">Created</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {jobsQuery.data.items.map((job) => (
                  <tr key={job.id}>
                    <td>{job.id.slice(0, 8).toUpperCase()}</td>
                    <td>{job.status.replaceAll("_", " ")}</td>
                    <td>{job.totalRows}</td>
                    <td>{job.errorCount}</td>
                    <td>{formatImportDate(job.createdAt)}</td>
                    <td>
                      <button
                        className="button button-secondary"
                        onClick={() => {
                          setSampleRows([]);
                          setCommitConfirmed(false);
                          void navigate({ search: { jobId: job.id } });
                        }}
                        type="button"
                      >
                        View job
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : jobsQuery.isError ? null : (
          <p className="master-live-state">No imports yet.</p>
        )}
        {jobsQuery.data && (
          <div className="asset-pagination" aria-label="Import job pages">
            <span>
              Page {page} of {pageCount(jobsQuery.data.total)}
            </span>
            <button
              className="button button-secondary"
              disabled={page <= 1 || jobsQuery.isFetching}
              onClick={() => setPage((current) => current - 1)}
              type="button"
            >
              Previous
            </button>
            <button
              className="button button-secondary"
              disabled={
                page >= pageCount(jobsQuery.data.total) || jobsQuery.isFetching
              }
              onClick={() => setPage((current) => current + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        )}
      </section>
      <p className="asset-import-policy">
        Only plain UTF-8 CSV is supported. Spreadsheet binaries, formulas,
        attachments, and error-file exports are not accepted. The import is
        all-or-nothing; failed commit rows never create partial assets.
      </p>
    </section>
  );
}
