import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authErrorMessage } from "../auth/auth-errors";
import { protectedQueryKey, useAuthStore } from "../auth/auth-store";
import { masterDataApi } from "../master-data/master-data-api";
import { canManageAssetRegister } from "./asset-access";
import { assetsApi, type CreateAssetReservationInput } from "./assets-api";

const reservationSchema = z
  .object({
    assetId: z.string().uuid("Choose an asset."),
    employeeId: z.string().uuid("Choose an employee."),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a start date."),
    expiresOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose an expiry date."),
    reason: z.string().trim().min(1, "Enter a reservation reason.").max(500),
  })
  .superRefine((value, context) => {
    const today = new Date().toISOString().slice(0, 10);
    if (value.startDate < today) {
      context.addIssue({
        code: "custom",
        message: "Start date cannot be before today.",
        path: ["startDate"],
      });
    }
    if (value.expiresOn < value.startDate) {
      context.addIssue({
        code: "custom",
        message: "Expiry date must be on or after the start date.",
        path: ["expiresOn"],
      });
    }
  });

function reservationDate(date: string): string {
  return date.slice(0, 10);
}

export function AssetReservationsPage() {
  const role = useAuthStore((state) => state.session?.user.role);
  const generation = useAuthStore((state) => state.generation);
  const queryClient = useQueryClient();
  const [reservationPage, setReservationPage] = useState(1);
  const [reservationSearch, setReservationSearch] = useState("");
  const [assetSearch, setAssetSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [attempt, setAttempt] = useState<{
    fingerprint: string;
    key: string;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);

  const reservationsQuery = useQuery({
    queryKey: protectedQueryKey(
      "reservations",
      reservationPage,
      reservationSearch,
    ),
    queryFn: () =>
      assetsApi.listReservations({
        page: reservationPage,
        pageSize: 20,
        search: reservationSearch.trim() || undefined,
      }),
    enabled: canManageAssetRegister(role),
  });
  const assetsQuery = useQuery({
    queryKey: protectedQueryKey("reservation-asset-options", assetSearch),
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
    queryKey: protectedQueryKey("reservation-employee-options", employeeSearch),
    queryFn: () =>
      masterDataApi.listEmployees({
        page: 1,
        pageSize: 20,
        search: employeeSearch.trim() || undefined,
      }),
    enabled: canManageAssetRegister(role) && employeeSearch.trim().length >= 2,
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
  } = useForm<CreateAssetReservationInput>({
    defaultValues: {
      assetId: "",
      employeeId: "",
      startDate: "",
      expiresOn: "",
      reason: "",
    },
  });
  const selectedAssetId = watch("assetId");
  const selectedEmployeeId = watch("employeeId");
  const createReservation = useMutation({
    mutationFn: ({
      input,
      idempotencyKey,
    }: {
      input: CreateAssetReservationInput;
      idempotencyKey: string;
    }) => assetsApi.createReservation(input, idempotencyKey),
    onSuccess: async () => {
      if (useAuthStore.getState().generation !== generation) return;
      reset();
      setAttempt(null);
      setMessageIsError(false);
      setMessage("Reservation created.");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("reservations"),
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
  const cancelReservation = useMutation({
    mutationFn: ({
      reservationId,
      version,
    }: {
      reservationId: string;
      version: number;
    }) => assetsApi.cancelReservation(reservationId, version),
    onSuccess: async () => {
      setMessageIsError(false);
      setMessage("Reservation cancelled.");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("reservations"),
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
  const pageCount = reservationsQuery.data
    ? Math.max(
        1,
        Math.ceil(
          reservationsQuery.data.total / reservationsQuery.data.pageSize,
        ),
      )
    : 1;

  if (!canManageAssetRegister(role)) {
    return (
      <section>
        <div className="page-heading">
          <p className="eyebrow">Hardware</p>
          <h1>Reservations</h1>
          <p className="page-description">
            Reservation management is available to Asset Managers within their
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
    const parsed = reservationSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (
          field === "assetId" ||
          field === "employeeId" ||
          field === "startDate" ||
          field === "expiresOn" ||
          field === "reason"
        ) {
          setError(field, { message: issue.message });
        }
      }
      return;
    }
    const fingerprint = JSON.stringify(parsed.data);
    const idempotencyKey =
      attempt?.fingerprint === fingerprint ? attempt.key : crypto.randomUUID();
    setAttempt({ fingerprint, key: idempotencyKey });
    createReservation.mutate({
      input: parsed.data,
      idempotencyKey,
    });
  });

  return (
    <section className="asset-reservations-page">
      <div className="page-heading">
        <p className="eyebrow">Hardware · Availability planning</p>
        <h1>Reservations</h1>
        <p className="page-description">
          Reserve active equipment for an employee over inclusive calendar
          dates. A reservation does not change asset custody.
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
            <p className="eyebrow">Availability planning</p>
            <h2>Create reservation</h2>
            <p>
              Only active, available assets and active employee references are
              eligible. Overlapping date windows are prevented.
            </p>
          </div>
        </div>
        <form className="user-create-form modern-form" onSubmit={submit}>
          <div className="modern-form-grid master-live-form-grid">
            <div className="modern-field">
              <label htmlFor="reservation-asset-search">Find asset</label>
              <input
                id="reservation-asset-search"
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
              {assetsQuery.isError && (
                <span className="field-error" role="alert">
                  {authErrorMessage(assetsQuery.error)}
                </span>
              )}
              {errors.assetId && (
                <span className="field-error" role="alert">
                  {errors.assetId.message}
                </span>
              )}
              <input type="hidden" {...register("assetId")} />
              {selectedAssetId && <small>Asset selected.</small>}
            </div>
            <div className="modern-field">
              <label htmlFor="reservation-employee-search">Find employee</label>
              <input
                id="reservation-employee-search"
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
              {employeesQuery.isError && (
                <span className="field-error" role="alert">
                  {authErrorMessage(employeesQuery.error)}
                </span>
              )}
              {errors.employeeId && (
                <span className="field-error" role="alert">
                  {errors.employeeId.message}
                </span>
              )}
              <input type="hidden" {...register("employeeId")} />
              {selectedEmployeeId && <small>Employee selected.</small>}
            </div>
            <div className="modern-field">
              <label htmlFor="reservation-start">Start date</label>
              <input
                id="reservation-start"
                type="date"
                {...register("startDate")}
                aria-invalid={Boolean(errors.startDate)}
              />
              {errors.startDate && (
                <span className="field-error" role="alert">
                  {errors.startDate.message}
                </span>
              )}
            </div>
            <div className="modern-field">
              <label htmlFor="reservation-expiry">Expiry date</label>
              <input
                id="reservation-expiry"
                type="date"
                {...register("expiresOn")}
                aria-invalid={Boolean(errors.expiresOn)}
              />
              {errors.expiresOn && (
                <span className="field-error" role="alert">
                  {errors.expiresOn.message}
                </span>
              )}
            </div>
            <div className="modern-field modern-field-wide">
              <label htmlFor="reservation-reason">Reason</label>
              <textarea
                id="reservation-reason"
                maxLength={500}
                {...register("reason")}
                aria-invalid={Boolean(errors.reason)}
              />
              {errors.reason && (
                <span className="field-error" role="alert">
                  {errors.reason.message}
                </span>
              )}
            </div>
          </div>
          <div className="modern-form-actions master-live-form-actions">
            <div>
              <strong>Asset Manager command</strong>
              <small>
                The same request reuses its idempotency key after a retry.
              </small>
            </div>
            <button
              className="button"
              disabled={createReservation.isPending}
              type="submit"
            >
              {createReservation.isPending
                ? "Reserving…"
                : "Create reservation"}
            </button>
          </div>
        </form>
      </section>

      <section className="user-admin-card">
        <div className="asset-reservations-list-heading">
          <div>
            <p className="eyebrow">Reservation ledger</p>
            <h2>Reservations</h2>
          </div>
          {reservationsQuery.data && (
            <span className="master-live-total">
              {reservationsQuery.data.total} total
            </span>
          )}
        </div>
        <label className="master-live-search asset-reservation-search">
          <span>Search asset, employee, or reason</span>
          <input
            onChange={(event) => {
              setReservationSearch(event.target.value);
              setReservationPage(1);
            }}
            value={reservationSearch}
          />
        </label>
        {reservationsQuery.isError && (
          <p className="form-error" role="alert">
            {authErrorMessage(reservationsQuery.error)}
          </p>
        )}
        {reservationsQuery.isPending ? (
          <p className="master-live-state" role="status">
            Loading reservations…
          </p>
        ) : reservationsQuery.data?.items.length ? (
          <div className="user-table-scroll">
            <table className="user-table">
              <thead>
                <tr>
                  <th scope="col">Asset</th>
                  <th scope="col">Reserved for</th>
                  <th scope="col">Dates</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Status</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {reservationsQuery.data.items.map((reservation) => (
                  <tr key={reservation.id}>
                    <td>{reservation.asset.assetTag}</td>
                    <td>
                      {reservation.employee.employeeNumber} ·{" "}
                      {reservation.employee.displayName}
                    </td>
                    <td>
                      {reservationDate(reservation.startDate)} –{" "}
                      {reservationDate(reservation.expiresOn)}
                    </td>
                    <td>{reservation.reason}</td>
                    <td>{reservation.status}</td>
                    <td>
                      {(reservation.status === "ACTIVE" ||
                        reservation.status === "SCHEDULED") && (
                        <button
                          className="button button-secondary"
                          disabled={cancelReservation.isPending}
                          onClick={() =>
                            cancelReservation.mutate({
                              reservationId: reservation.id,
                              version: reservation.version,
                            })
                          }
                          type="button"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : reservationsQuery.isError ? null : (
          <p className="master-live-state">No reservations found.</p>
        )}
        {reservationsQuery.data && (
          <div className="asset-pagination" aria-label="Reservation pages">
            <span>
              Page {reservationPage} of {pageCount}
            </span>
            <button
              className="button button-secondary"
              disabled={reservationPage <= 1 || reservationsQuery.isFetching}
              onClick={() => setReservationPage((current) => current - 1)}
              type="button"
            >
              Previous
            </button>
            <button
              className="button button-secondary"
              disabled={
                reservationPage >= pageCount || reservationsQuery.isFetching
              }
              onClick={() => setReservationPage((current) => current + 1)}
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
