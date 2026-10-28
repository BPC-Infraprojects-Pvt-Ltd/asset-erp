import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";
import { authApi, type LoginInput } from "./auth-api";
import { authErrorMessage } from "./auth-errors";
import { clearProtectedCache } from "./auth-cache";
import { useAuthStore } from "./auth-store";

const loginSchema = z.object({
  organizationId: z.string().uuid("Enter a valid organization ID."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setSession = useAuthStore((state) => state.setSession);
  const notice = useAuthStore((state) => state.notice);
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>();
  const [message, setMessage] = useState<string | null>(null);

  const submit = handleSubmit(async (values) => {
    setMessage(null);
    clearErrors();
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (
          field === "organizationId" ||
          field === "email" ||
          field === "password"
        ) {
          setError(field, { message: issue.message });
        }
      }
      return;
    }

    try {
      await clearProtectedCache(queryClient);
      const session = await authApi.login(parsed.data);
      setSession(session);
      const identity = await authApi.me();
      const hydratedSession = { ...session, user: identity.user };
      setSession(hydratedSession);
      await navigate({
        to: identity.user.mustChangePassword ? "/password/change" : "/",
      });
    } catch (error) {
      setMessage(authErrorMessage(error));
    }
  });

  return (
    <section className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">Secure access</p>
        <h1>Sign in</h1>
        <p className="page-description">
          Use the organization ID and account details provided by your
          administrator.
        </p>
        {notice && (
          <p className="form-notice" role="status">
            {notice}
          </p>
        )}
        {message && (
          <p className="form-error" role="alert">
            {message}
          </p>
        )}
        <form className="auth-form" onSubmit={submit} noValidate>
          <label htmlFor="organizationId">Organization ID</label>
          <input
            autoComplete="organization"
            id="organizationId"
            {...register("organizationId")}
            aria-invalid={Boolean(errors.organizationId)}
            aria-describedby={
              errors.organizationId ? "organizationId-error" : undefined
            }
          />
          {errors.organizationId && (
            <span className="field-error" id="organizationId-error">
              {errors.organizationId.message}
            </span>
          )}

          <label htmlFor="email">Email</label>
          <input
            autoComplete="username"
            id="email"
            type="email"
            {...register("email")}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email && (
            <span className="field-error" id="email-error">
              {errors.email.message}
            </span>
          )}

          <label htmlFor="password">Password</label>
          <input
            autoComplete="current-password"
            id="password"
            type="password"
            {...register("password")}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
          />
          {errors.password && (
            <span className="field-error" id="password-error">
              {errors.password.message}
            </span>
          )}

          <button className="button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </section>
  );
}
