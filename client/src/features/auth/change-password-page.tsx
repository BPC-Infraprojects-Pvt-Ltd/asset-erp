import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";
import { authApi, type ChangePasswordInput } from "./auth-api";
import { authErrorMessage } from "./auth-errors";
import { clearProtectedCache } from "./auth-cache";
import { useAuthStore } from "./auth-store";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(72, "Use no more than 72 characters."),
});

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setAnonymous = useAuthStore((state) => state.setAnonymous);
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>();
  const [message, setMessage] = useState<string | null>(null);

  const submit = handleSubmit(async (values) => {
    setMessage(null);
    clearErrors();
    const parsed = passwordSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === "currentPassword" || field === "newPassword") {
          setError(field, { message: issue.message });
        }
      }
      return;
    }

    try {
      await authApi.changePassword(parsed.data);
      await clearProtectedCache(queryClient);
      setAnonymous("Password changed. Sign in with your new password.");
      await navigate({ to: "/login" });
    } catch (error) {
      setMessage(authErrorMessage(error));
    }
  });

  return (
    <section className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">Account security</p>
        <h1>Change your password</h1>
        <p className="page-description">
          Choose a password with at least 8 characters. You will need to sign in
          again after it is changed.
        </p>
        {message && (
          <p className="form-error" role="alert">
            {message}
          </p>
        )}
        <form className="auth-form" onSubmit={submit} noValidate>
          <label htmlFor="currentPassword">Current password</label>
          <input
            autoComplete="current-password"
            id="currentPassword"
            type="password"
            {...register("currentPassword")}
            aria-invalid={Boolean(errors.currentPassword)}
            aria-describedby={
              errors.currentPassword ? "currentPassword-error" : undefined
            }
          />
          {errors.currentPassword && (
            <span className="field-error" id="currentPassword-error">
              {errors.currentPassword.message}
            </span>
          )}

          <label htmlFor="newPassword">New password</label>
          <input
            autoComplete="new-password"
            id="newPassword"
            type="password"
            {...register("newPassword")}
            aria-invalid={Boolean(errors.newPassword)}
            aria-describedby={
              errors.newPassword ? "newPassword-error" : undefined
            }
          />
          {errors.newPassword && (
            <span className="field-error" id="newPassword-error">
              {errors.newPassword.message}
            </span>
          )}

          <button className="button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </section>
  );
}
