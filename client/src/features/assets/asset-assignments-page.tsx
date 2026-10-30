import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authErrorMessage } from "../auth/auth-errors";
import { protectedQueryKey, useAuthStore } from "../auth/auth-store";
import { masterDataApi } from "../master-data/master-data-api";
import { canManageAssetRegister } from "./asset-access";
import {
  assetsApi,
  type AssetAssignment,
  type CreateAssetAssignmentInput,
  type ReturnAssetAssignmentInput,
} from "./assets-api";

const assignmentSchema = z
  .object({
    assetId: z.string().uuid("Choose an asset."),
    recipientType: z.enum(["EMPLOYEE", "TEAM", "SHARED_POOL"]),
    employeeId: z.string(),
    recipientLabel: z.string().trim().max(160),
    expectedReturnDate: z.string(),
    conditionAtIssue: z.enum([
      "NEW",
      "GOOD",
      "FAIR",
      "DAMAGED",
      "NONFUNCTIONAL",
      "UNKNOWN",
    ]),
    accessoriesAtIssue: z.string().trim().max(1000),
    purpose: z.string().trim().min(1, "Enter the assignment purpose.").max(500),
  })
  .superRefine((value, context) => {
    if (
      value.recipientType === "EMPLOYEE" &&
      !z.string().uuid().safeParse(value.employeeId).success
    ) {
      context.addIssue({
        code: "custom",
        message: "Choose an employee.",
        path: ["employeeId"],
      });
    }
    if (value.recipientType !== "EMPLOYEE" && !value.recipientLabel) {
      context.addIssue({
        code: "custom",
        message: "Enter the team or shared-pool name.",
        path: ["recipientLabel"],
      });
    }
    if (value.expectedReturnDate) {
      const date = new Date(`${value.expectedReturnDate}T00:00:00.000Z`);
      if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value.expectedReturnDate ||
        value.expectedReturnDate < new Date().toISOString().slice(0, 10)
      ) {
        context.addIssue({
          code: "custom",
          message: "Choose a valid expected return date.",
          path: ["expectedReturnDate"],
        });
      }
    }
  });

const returnSchema = z.object({
  conditionAtReturn: z.enum([
    "NEW",
    "GOOD",
    "FAIR",
    "DAMAGED",
    "NONFUNCTIONAL",
    "UNKNOWN",
  ]),
  accessoriesReturned: z.string().trim().max(1000),
  missingItems: z.string().trim().max(1000),
  followUp: z.string().trim().max(1000),
  inspectionRequired: z.boolean(),
});

function reservationDate(date: string): string {
  return date.slice(0, 10);
}

function AssignmentReturnForm({
  assignment,
  onComplete,
}: {
  assignment: AssetAssignment;
  onComplete: () => void;
}) {
  const queryClient = useQueryClient();
  const [attempt, setAttempt] = useState<{
    fingerprint: string;
    key: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { register, handleSubmit } = useForm<ReturnAssetAssignmentInput>({
    defaultValues: {
      conditionAtReturn: assignment.conditionAtIssue,
      accessoriesReturned: "",
      missingItems: "",
      followUp: "",
      inspectionRequired: false,
    },
  });
  const returnAsset = useMutation({
    mutationFn: ({
      input,
      key,
    }: {
      input: ReturnAssetAssignmentInput;
      key: string;
    }) =>
      assetsApi.returnAssignment(assignment.id, assignment.version, key, input),
    onSuccess: async () => {
      setAttempt(null);
      setErrorMessage(null);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("assignments"),
        }),
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("assets"),
        }),
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("asset-history", assignment.assetId),
        }),
      ]);
      onComplete();
    },
    onError: (error) => setErrorMessage(authErrorMessage(error)),
  });

  const submit = handleSubmit((values) => {
    setErrorMessage(null);
    const parsed = returnSchema.safeParse(values);
    if (!parsed.success) {
      setErrorMessage(
        parsed.error.issues[0]?.message ?? "Review the return details.",
      );
      return;
    }
    const fingerprint = JSON.stringify(parsed.data);
    const key =
      attempt?.fingerprint === fingerprint ? attempt.key : crypto.randomUUID();
    setAttempt({ fingerprint, key });
    returnAsset.mutate({ input: parsed.data, key });
  });

  return (
    <form className="assignment-return-form" onSubmit={submit}>
      <div className="modern-form-grid master-live-form-grid">
        <div className="modern-field">
          <label htmlFor={`return-condition-${assignment.id}`}>
            Condition at return
          </label>
          <select
            id={`return-condition-${assignment.id}`}
            {...register("conditionAtReturn")}
          >
            {["NEW", "GOOD", "FAIR", "DAMAGED", "NONFUNCTIONAL", "UNKNOWN"].map(
              (condition) => (
                <option key={condition} value={condition}>
                  {condition.replaceAll("_", " ")}
                </option>
              ),
            )}
          </select>
        </div>
        <div className="modern-field">
          <label htmlFor={`return-accessories-${assignment.id}`}>
            Accessories returned
          </label>
          <textarea
            id={`return-accessories-${assignment.id}`}
            maxLength={1000}
            {...register("accessoriesReturned")}
          />
        </div>
        <div className="modern-field">
          <label htmlFor={`return-missing-${assignment.id}`}>
            Missing items
          </label>
          <textarea
            id={`return-missing-${assignment.id}`}
            maxLength={1000}
            {...register("missingItems")}
          />
        </div>
        <div className="modern-field">
          <label htmlFor={`return-follow-up-${assignment.id}`}>Follow-up</label>
          <textarea
            id={`return-follow-up-${assignment.id}`}
            maxLength={1000}
            {...register("followUp")}
          />
        </div>
        <label className="assignment-inspection-toggle">
          <input type="checkbox" {...register("inspectionRequired")} />
          Requires inspection before availability
        </label>
      </div>
      {errorMessage && (
        <p className="form-error" role="alert">
          {errorMessage}
        </p>
      )}
      <div className="modern-form-actions master-live-form-actions">
        <small>
          Returns requiring inspection or reporting damage are quarantined.
        </small>
        <button
          className="button"
          disabled={returnAsset.isPending}
          type="submit"
        >
          {returnAsset.isPending ? "Recording return…" : "Record return"}
        </button>
      </div>
    </form>
  );
}

export function AssetAssignmentsPage() {
  const role = useAuthStore((state) => state.session?.user.role);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [assetSearch, setAssetSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [recipientType, setRecipientType] =
    useState<CreateAssetAssignmentInput["recipientType"]>("EMPLOYEE");
  const [returningAssignmentId, setReturningAssignmentId] = useState<
    string | null
  >(null);
  const [attempt, setAttempt] = useState<{
    fingerprint: string;
    key: string;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const assignmentsQuery = useQuery({
    queryKey: protectedQueryKey("assignments", page, search),
    queryFn: () =>
      assetsApi.listAssignments({
        page,
        pageSize: 20,
        search: search.trim() || undefined,
      }),
    enabled: canManageAssetRegister(role),
  });
  const assetsQuery = useQuery({
    queryKey: protectedQueryKey("assignment-asset-options", assetSearch),
    queryFn: () =>
      assetsApi.list({
        page: 1,
        pageSize: 20,
        lifecycle: "ACTIVE",
        availability: "AVAILABLE",
        search: assetSearch.trim() || undefined,
      }),
    enabled: canManageAssetRegister(role) && assetSearch.trim().length >= 2,
  });
  const employeesQuery = useQuery({
    queryKey: protectedQueryKey("assignment-employee-options", employeeSearch),
    queryFn: () =>
      masterDataApi.listEmployees({
        page: 1,
        pageSize: 20,
        search: employeeSearch.trim() || undefined,
      }),
    enabled:
      canManageAssetRegister(role) &&
      recipientType === "EMPLOYEE" &&
      employeeSearch.trim().length >= 2,
  });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateAssetAssignmentInput>({
    defaultValues: {
      assetId: "",
      recipientType: "EMPLOYEE",
      employeeId: "",
      recipientLabel: "",
      expectedReturnDate: "",
      conditionAtIssue: "GOOD",
      accessoriesAtIssue: "",
      purpose: "",
    },
  });
  const selectedAssetId = watch("assetId");
  const selectedEmployeeId = watch("employeeId");
  const createAssignment = useMutation({
    mutationFn: ({
      input,
      key,
    }: {
      input: CreateAssetAssignmentInput;
      key: string;
    }) => assetsApi.createAssignment(input, key),
    onSuccess: async () => {
      reset();
      setAttempt(null);
      setMessageIsError(false);
      setMessage("Assignment recorded; employee acknowledgment is pending.");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("assignments"),
        }),
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("assets"),
        }),
      ]);
    },
    onError: (error) => {
      setMessageIsError(true);
      setMessage(authErrorMessage(error));
    },
  });
  const pageCount = assignmentsQuery.data
    ? Math.max(
        1,
        Math.ceil(assignmentsQuery.data.total / assignmentsQuery.data.pageSize),
      )
    : 1;

  if (!canManageAssetRegister(role)) {
    return (
      <section>
        <div className="page-heading">
          <p className="eyebrow">Hardware</p>
          <h1>Assignments &amp; Returns</h1>
          <p className="page-description">
            Custody commands are available to Asset Managers within their
            assigned location scope.
          </p>
        </div>
        <p className="form-error" role="alert">
          Asset Manager access is required.
        </p>
      </section>
    );
  }

  const submit = handleSubmit((values) => {
    setMessage(null);
    clearErrors();
    const parsed = assignmentSchema.safeParse({
      ...values,
      recipientType,
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (
          field === "assetId" ||
          field === "employeeId" ||
          field === "recipientLabel" ||
          field === "expectedReturnDate" ||
          field === "purpose"
        ) {
          setError(field, { message: issue.message });
        }
      }
      return;
    }
    const input: CreateAssetAssignmentInput = {
      ...parsed.data,
      employeeId:
        parsed.data.recipientType === "EMPLOYEE"
          ? parsed.data.employeeId
          : undefined,
      recipientLabel:
        parsed.data.recipientType === "EMPLOYEE"
          ? undefined
          : parsed.data.recipientLabel,
      expectedReturnDate: parsed.data.expectedReturnDate || undefined,
      accessoriesAtIssue: parsed.data.accessoriesAtIssue || undefined,
    };
    const fingerprint = JSON.stringify(input);
    const key =
      attempt?.fingerprint === fingerprint ? attempt.key : crypto.randomUUID();
    setAttempt({ fingerprint, key });
    createAssignment.mutate({ input, key });
  });

  return (
    <section className="asset-assignments-page">
      <div className="page-heading">
        <p className="eyebrow">Hardware · Custody</p>
        <h1>Assignments &amp; Returns</h1>
        <p className="page-description">
          Record employee, team, or shared-pool custody. Employee acknowledgment
          remains pending until employee sign-in linkage is available.
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
            <p className="eyebrow">Custody handover</p>
            <h2>Assign active asset</h2>
            <p>
              Assignments update custody without changing physical location.
            </p>
          </div>
        </div>
        <form className="user-create-form modern-form" onSubmit={submit}>
          <div className="modern-form-grid master-live-form-grid">
            <div className="modern-field">
              <label htmlFor="assignment-asset-search">Find asset</label>
              <input
                id="assignment-asset-search"
                onChange={(event) => {
                  setAssetSearch(event.target.value);
                  setValue("assetId", "");
                }}
                placeholder="Search at least 2 characters"
                value={assetSearch}
              />
              {assetsQuery.data?.items.map((asset) => (
                <button
                  className={
                    selectedAssetId === asset.id
                      ? "asset-reservation-option selected"
                      : "asset-reservation-option"
                  }
                  key={asset.id}
                  onClick={() => setValue("assetId", asset.id)}
                  type="button"
                >
                  {asset.assetTag} · {asset.category.name} ·{" "}
                  {asset.location.code}
                </button>
              ))}
              {errors.assetId && (
                <span className="field-error" role="alert">
                  {errors.assetId.message}
                </span>
              )}
              <input type="hidden" {...register("assetId")} />
            </div>
            <div className="modern-field">
              <label htmlFor="assignment-recipient-type">Recipient type</label>
              <select
                id="assignment-recipient-type"
                onChange={(event) => {
                  const next = event.target
                    .value as CreateAssetAssignmentInput["recipientType"];
                  setRecipientType(next);
                  setValue("recipientType", next);
                  setValue("employeeId", "");
                  setValue("recipientLabel", "");
                }}
                value={recipientType}
              >
                <option value="EMPLOYEE">Employee</option>
                <option value="TEAM">Team</option>
                <option value="SHARED_POOL">Shared pool</option>
              </select>
              <input type="hidden" {...register("recipientType")} />
            </div>
            {recipientType === "EMPLOYEE" ? (
              <div className="modern-field">
                <label htmlFor="assignment-employee-search">
                  Find employee
                </label>
                <input
                  id="assignment-employee-search"
                  onChange={(event) => {
                    setEmployeeSearch(event.target.value);
                    setValue("employeeId", "");
                  }}
                  placeholder="Search employee number or name"
                  value={employeeSearch}
                />
                {employeesQuery.data?.items.map((employee) => (
                  <button
                    className={
                      selectedEmployeeId === employee.id
                        ? "asset-reservation-option selected"
                        : "asset-reservation-option"
                    }
                    key={employee.id}
                    onClick={() => setValue("employeeId", employee.id)}
                    type="button"
                  >
                    {employee.employeeNumber} · {employee.displayName}
                  </button>
                ))}
                {errors.employeeId && (
                  <span className="field-error" role="alert">
                    {errors.employeeId.message}
                  </span>
                )}
                <input type="hidden" {...register("employeeId")} />
              </div>
            ) : (
              <div className="modern-field">
                <label htmlFor="assignment-recipient-label">
                  {recipientType === "TEAM" ? "Team name" : "Pool name"}
                </label>
                <input
                  id="assignment-recipient-label"
                  maxLength={160}
                  {...register("recipientLabel")}
                />
                {errors.recipientLabel && (
                  <span className="field-error" role="alert">
                    {errors.recipientLabel.message}
                  </span>
                )}
              </div>
            )}
            <div className="modern-field">
              <label htmlFor="assignment-condition">Condition at issue</label>
              <select
                id="assignment-condition"
                {...register("conditionAtIssue")}
              >
                {["NEW", "GOOD", "FAIR", "DAMAGED", "UNKNOWN"].map(
                  (condition) => (
                    <option key={condition} value={condition}>
                      {condition}
                    </option>
                  ),
                )}
              </select>
            </div>
            <div className="modern-field">
              <label htmlFor="assignment-return-date">
                Expected return date <span>Optional</span>
              </label>
              <input
                id="assignment-return-date"
                type="date"
                {...register("expectedReturnDate")}
              />
              {errors.expectedReturnDate && (
                <span className="field-error" role="alert">
                  {errors.expectedReturnDate.message}
                </span>
              )}
            </div>
            <div className="modern-field">
              <label htmlFor="assignment-purpose">Purpose</label>
              <input
                id="assignment-purpose"
                maxLength={500}
                {...register("purpose")}
              />
              {errors.purpose && (
                <span className="field-error" role="alert">
                  {errors.purpose.message}
                </span>
              )}
            </div>
            <div className="modern-field modern-field-wide">
              <label htmlFor="assignment-accessories">
                Accessories at issue <span>Optional</span>
              </label>
              <textarea
                id="assignment-accessories"
                maxLength={1000}
                {...register("accessoriesAtIssue")}
              />
            </div>
          </div>
          <div className="modern-form-actions master-live-form-actions">
            <div>
              <strong>Asset Manager command</strong>
              <small>
                Create retries reuse the same idempotency key for the same
                request.
              </small>
            </div>
            <button
              className="button"
              disabled={createAssignment.isPending}
              type="submit"
            >
              {createAssignment.isPending ? "Assigning…" : "Create assignment"}
            </button>
          </div>
        </form>
      </section>

      <section className="user-admin-card">
        <div className="asset-reservations-list-heading">
          <div>
            <p className="eyebrow">Custody ledger</p>
            <h2>Assignments</h2>
          </div>
          {assignmentsQuery.data && (
            <span className="master-live-total">
              {assignmentsQuery.data.total} total
            </span>
          )}
        </div>
        <label className="master-live-search asset-reservation-search">
          <span>Search asset, recipient, or purpose</span>
          <input
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            value={search}
          />
        </label>
        {assignmentsQuery.isError && (
          <p className="form-error" role="alert">
            {authErrorMessage(assignmentsQuery.error)}
          </p>
        )}
        {assignmentsQuery.isPending ? (
          <p className="master-live-state" role="status">
            Loading assignments…
          </p>
        ) : assignmentsQuery.data?.items.length ? (
          <div className="user-table-scroll">
            <table className="user-table">
              <thead>
                <tr>
                  <th scope="col">Asset</th>
                  <th scope="col">Recipient</th>
                  <th scope="col">Issued</th>
                  <th scope="col">Due</th>
                  <th scope="col">Acknowledgment</th>
                  <th scope="col">Status</th>
                  <th scope="col">Return</th>
                </tr>
              </thead>
              <tbody>
                {assignmentsQuery.data.items.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>{assignment.asset.assetTag}</td>
                    <td>
                      {assignment.employee
                        ? `${assignment.employee.employeeNumber} · ${assignment.employee.displayName}`
                        : `${assignment.recipientType.replaceAll("_", " ")} · ${assignment.recipientLabel}`}
                    </td>
                    <td>{reservationDate(assignment.issuedAt)}</td>
                    <td>
                      {assignment.expectedReturnDate
                        ? reservationDate(assignment.expectedReturnDate)
                        : "—"}
                    </td>
                    <td>{assignment.acknowledgementStatus}</td>
                    <td>{assignment.status}</td>
                    <td>
                      {assignment.status !== "RETURNED" &&
                        (returningAssignmentId === assignment.id ? (
                          <AssignmentReturnForm
                            assignment={assignment}
                            onComplete={() => setReturningAssignmentId(null)}
                          />
                        ) : (
                          <button
                            className="button button-secondary"
                            onClick={() =>
                              setReturningAssignmentId(assignment.id)
                            }
                            type="button"
                          >
                            Record return
                          </button>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : assignmentsQuery.isError ? null : (
          <p className="master-live-state">No assignments found.</p>
        )}
        {assignmentsQuery.data && (
          <div className="asset-pagination" aria-label="Assignment pages">
            <span>
              Page {page} of {pageCount}
            </span>
            <button
              className="button button-secondary"
              disabled={page <= 1 || assignmentsQuery.isFetching}
              onClick={() => setPage((current) => current - 1)}
              type="button"
            >
              Previous
            </button>
            <button
              className="button button-secondary"
              disabled={page >= pageCount || assignmentsQuery.isFetching}
              onClick={() => setPage((current) => current + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </section>
  );
}
