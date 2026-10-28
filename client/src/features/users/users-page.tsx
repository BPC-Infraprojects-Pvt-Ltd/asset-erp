import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { UserRole } from "../../lib/api/auth-contract";
import { protectedQueryKey } from "../auth/auth-store";
import { useAuthStore } from "../auth/auth-store";
import { authErrorMessage } from "../auth/auth-errors";
import { locationsApi, type Location } from "../locations/locations-api";
import { usersApi, type CreateUserInput, type ManagedUser } from "./users-api";

const userRoles: { value: UserRole; label: string }[] = [
  { value: "ADMINISTRATOR", label: "Administrator" },
  { value: "ASSET_MANAGER", label: "Asset Manager" },
  { value: "TECHNICIAN", label: "Technician" },
  { value: "SOFTWARE_LICENSE_MANAGER", label: "Software/License Manager" },
  { value: "PROCUREMENT_FINANCE", label: "Procurement/Finance" },
  { value: "MANAGER_APPROVER", label: "Manager/Approver" },
  { value: "EMPLOYEE", label: "Employee" },
  { value: "AUDITOR", label: "Auditor" },
];

const createUserSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254),
  displayName: z.string().trim().min(1).max(160),
  temporaryPassword: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(72, "Use no more than 72 characters."),
  role: z.enum([
    "ADMINISTRATOR",
    "ASSET_MANAGER",
    "TECHNICIAN",
    "SOFTWARE_LICENSE_MANAGER",
    "PROCUREMENT_FINANCE",
    "MANAGER_APPROVER",
    "EMPLOYEE",
    "AUDITOR",
  ]),
});
const resetPasswordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use no more than 72 characters.");

function isUserRole(value: string): value is UserRole {
  return userRoles.some((role) => role.value === value);
}

function hasLocationScope(role: UserRole): boolean {
  return role === "ASSET_MANAGER" || role === "PROCUREMENT_FINANCE";
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const actorId = useAuthStore((state) => state.session?.user.id);
  const [message, setMessage] = useState<string | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<ManagedUser | null>(
    null,
  );
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [scopeTarget, setScopeTarget] = useState<ManagedUser | null>(null);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const usersQuery = useQuery({
    queryKey: protectedQueryKey("users"),
    queryFn: usersApi.list,
  });
  const locationsQuery = useQuery({
    queryKey: protectedQueryKey("locations"),
    queryFn: locationsApi.list,
  });
  const createUser = useMutation({
    mutationFn: usersApi.create,
    onSuccess: async () => {
      setMessage(null);
      reset();
      await queryClient.invalidateQueries({
        queryKey: protectedQueryKey("users"),
      });
    },
    onError: (error) => setMessage(authErrorMessage(error)),
  });
  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      usersApi.changeRole(userId, role),
    onSuccess: async (user) => {
      setMessage(null);
      if (scopeTarget?.id === user.id && !hasLocationScope(user.role)) {
        setScopeTarget(null);
        setSelectedLocationIds([]);
      }
      await queryClient.invalidateQueries({
        queryKey: protectedQueryKey("users"),
      });
    },
    onError: (error) => setMessage(authErrorMessage(error)),
  });
  const deactivate = useMutation({
    mutationFn: usersApi.deactivate,
    onSuccess: async () => {
      setMessage(null);
      await queryClient.invalidateQueries({
        queryKey: protectedQueryKey("users"),
      });
    },
    onError: (error) => setMessage(authErrorMessage(error)),
  });
  const resetPassword = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      usersApi.resetPassword(userId, password),
    onSuccess: async () => {
      setMessage(null);
      setPasswordTarget(null);
      setTemporaryPassword("");
      setPasswordError(null);
      await queryClient.invalidateQueries({
        queryKey: protectedQueryKey("users"),
      });
    },
    onError: (error) => setMessage(authErrorMessage(error)),
  });
  const updateLocationScopes = useMutation({
    mutationFn: ({
      userId,
      locationIds,
    }: {
      userId: string;
      locationIds: string[];
    }) => usersApi.setLocationScopes(userId, locationIds),
    onSuccess: async () => {
      setMessage(null);
      setScopeTarget(null);
      setSelectedLocationIds([]);
      await queryClient.invalidateQueries({
        queryKey: protectedQueryKey("users"),
      });
    },
    onError: (error) => setMessage(authErrorMessage(error)),
  });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserInput>({
    defaultValues: {
      role: "EMPLOYEE",
      email: "",
      displayName: "",
      temporaryPassword: "",
    },
  });

  const submit = handleSubmit(async (values) => {
    setMessage(null);
    const parsed = createUserSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (
          field === "email" ||
          field === "displayName" ||
          field === "temporaryPassword" ||
          field === "role"
        ) {
          setError(field, { message: issue.message });
        }
      }
      return;
    }
    createUser.mutate(parsed.data);
  });

  return (
    <section>
      <div className="page-heading">
        <p className="eyebrow">Administration</p>
        <h1>Users</h1>
        <p className="page-description">
          Create organization-scoped accounts and assign one role to each user.
          New users must change their temporary password at sign-in.
        </p>
      </div>

      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
      {usersQuery.isError && (
        <p className="form-error" role="alert">
          {authErrorMessage(usersQuery.error)}
        </p>
      )}

      {passwordTarget && (
        <section
          className="user-admin-card"
          aria-labelledby="reset-password-heading"
        >
          <h2 id="reset-password-heading">
            {passwordTarget.isActive ? "Reset password" : "Reactivate account"}
          </h2>
          <p>
            Set a temporary password for {passwordTarget.displayName}. The
            account will be active and must change it at the next sign-in.
          </p>
          <form
            className="user-create-form"
            onSubmit={(event) => {
              event.preventDefault();
              const parsed = resetPasswordSchema.safeParse(temporaryPassword);
              if (!parsed.success) {
                setPasswordError(
                  parsed.error.issues[0]?.message ?? "Invalid password.",
                );
                return;
              }
              setPasswordError(null);
              resetPassword.mutate({
                userId: passwordTarget.id,
                password: parsed.data,
              });
            }}
          >
            <label htmlFor="reset-temporary-password">Temporary password</label>
            <input
              id="reset-temporary-password"
              autoComplete="new-password"
              type="password"
              value={temporaryPassword}
              onChange={(event) => setTemporaryPassword(event.target.value)}
              aria-invalid={Boolean(passwordError)}
            />
            {passwordError && (
              <span className="field-error">{passwordError}</span>
            )}
            <div className="user-form-actions">
              <button
                className="button"
                disabled={resetPassword.isPending}
                type="submit"
              >
                {passwordTarget.isActive
                  ? "Reset password"
                  : "Reactivate account"}
              </button>
              <button
                className="button button-secondary"
                disabled={resetPassword.isPending}
                onClick={() => {
                  setPasswordTarget(null);
                  setTemporaryPassword("");
                  setPasswordError(null);
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {scopeTarget && (
        <section
          className="user-admin-card"
          aria-labelledby="location-scope-heading"
        >
          <h2 id="location-scope-heading">
            Location access for {scopeTarget.displayName}
          </h2>
          <p>
            Each selected location also grants access to descendant locations
            and their stores. No selections means no location-scoped access.
          </p>
          {locationsQuery.isError && (
            <p className="form-error" role="alert">
              {authErrorMessage(locationsQuery.error)}
            </p>
          )}
          {locationsQuery.data?.length ? (
            <div className="scope-location-list">
              {locationsQuery.data.map((location: Location) => (
                <label key={location.id}>
                  <input
                    checked={selectedLocationIds.includes(location.id)}
                    disabled={updateLocationScopes.isPending}
                    type="checkbox"
                    onChange={(event) => {
                      setSelectedLocationIds((current) =>
                        event.target.checked
                          ? [...current, location.id]
                          : current.filter((id) => id !== location.id),
                      );
                    }}
                  />
                  <span>
                    <strong>{location.code}</strong> — {location.name}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <p>No active locations have been created.</p>
          )}
          <div className="user-form-actions">
            <button
              className="button"
              disabled={
                updateLocationScopes.isPending || locationsQuery.isPending
              }
              onClick={() =>
                updateLocationScopes.mutate({
                  userId: scopeTarget.id,
                  locationIds: selectedLocationIds,
                })
              }
              type="button"
            >
              Save location access
            </button>
            <button
              className="button button-secondary"
              disabled={updateLocationScopes.isPending}
              onClick={() => {
                setScopeTarget(null);
                setSelectedLocationIds([]);
              }}
              type="button"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      <section
        className="user-admin-card"
        aria-labelledby="create-user-heading"
      >
        <h2 id="create-user-heading">Create user</h2>
        <form className="user-create-form" onSubmit={submit} noValidate>
          <label htmlFor="user-display-name">Name</label>
          <input
            id="user-display-name"
            autoComplete="name"
            {...register("displayName")}
            aria-invalid={Boolean(errors.displayName)}
          />
          {errors.displayName && (
            <span className="field-error">{errors.displayName.message}</span>
          )}

          <label htmlFor="user-email">Email</label>
          <input
            id="user-email"
            type="email"
            autoComplete="email"
            {...register("email")}
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email && (
            <span className="field-error">{errors.email.message}</span>
          )}

          <label htmlFor="user-temporary-password">Temporary password</label>
          <input
            id="user-temporary-password"
            type="password"
            autoComplete="new-password"
            {...register("temporaryPassword")}
            aria-invalid={Boolean(errors.temporaryPassword)}
          />
          {errors.temporaryPassword && (
            <span className="field-error">
              {errors.temporaryPassword.message}
            </span>
          )}

          <label htmlFor="user-role">Role</label>
          <select id="user-role" {...register("role")}>
            {userRoles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>

          <button
            className="button"
            disabled={isSubmitting || createUser.isPending}
            type="submit"
          >
            Create user
          </button>
        </form>
      </section>

      <section className="user-admin-card" aria-labelledby="user-list-heading">
        <h2 id="user-list-heading">Organization users</h2>
        {usersQuery.isPending ? (
          <p role="status">Loading users…</p>
        ) : usersQuery.data?.length ? (
          <div className="user-table-scroll">
            <table className="user-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Location access</th>
                  <th scope="col">Status</th>
                  <th scope="col">Password</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.data.map((user) => (
                  <tr key={user.id}>
                    <td>{user.displayName}</td>
                    <td>{user.email}</td>
                    <td>
                      <select
                        aria-label={`Role for ${user.displayName}`}
                        disabled={
                          !user.isActive ||
                          user.id === actorId ||
                          changeRole.isPending ||
                          createUser.isPending ||
                          deactivate.isPending ||
                          resetPassword.isPending
                        }
                        value={user.role}
                        onChange={(event) => {
                          const role = event.target.value;
                          if (isUserRole(role)) {
                            changeRole.mutate({ userId: user.id, role });
                          }
                        }}
                      >
                        {userRoles.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {hasLocationScope(user.role) ? (
                        <div className="user-row-actions">
                          <span>
                            {user.locationScopes.length
                              ? user.locationScopes
                                  .map(
                                    ({ location }) =>
                                      `${location.code} — ${location.name}`,
                                  )
                                  .join(", ")
                              : "None"}
                          </span>
                          <button
                            className="button button-secondary"
                            disabled={
                              locationsQuery.isPending ||
                              updateLocationScopes.isPending ||
                              createUser.isPending
                            }
                            onClick={() => {
                              setScopeTarget(user);
                              setSelectedLocationIds(
                                user.locationScopes.map(
                                  ({ locationId }) => locationId,
                                ),
                              );
                            }}
                            type="button"
                          >
                            Manage
                          </button>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{user.isActive ? "Active" : "Inactive"}</td>
                    <td>
                      {user.mustChangePassword
                        ? "Change required"
                        : "Up to date"}
                    </td>
                    <td>
                      {user.id !== actorId && (
                        <div className="user-row-actions">
                          <button
                            className="button button-secondary"
                            disabled={
                              deactivate.isPending ||
                              changeRole.isPending ||
                              resetPassword.isPending
                            }
                            onClick={() => setPasswordTarget(user)}
                            type="button"
                          >
                            {user.isActive ? "Reset password" : "Reactivate"}
                          </button>
                          {user.isActive && (
                            <button
                              className="button button-secondary"
                              disabled={
                                deactivate.isPending ||
                                changeRole.isPending ||
                                resetPassword.isPending
                              }
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Deactivate ${user.displayName}? Their active sessions will be revoked.`,
                                  )
                                ) {
                                  deactivate.mutate(user.id);
                                }
                              }}
                              type="button"
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No users found.</p>
        )}
      </section>
    </section>
  );
}
