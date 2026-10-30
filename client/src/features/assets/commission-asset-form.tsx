import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authErrorMessage } from "../auth/auth-errors";
import { protectedQueryKey, useAuthStore } from "../auth/auth-store";
import { assetsApi, type Asset } from "./assets-api";

const commissioningSchema = z.object({
  commissioningDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a commissioning date.")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
      );
    }, "Choose a valid calendar date."),
});

export function CommissionAssetForm({ asset }: { asset: Asset }) {
  const queryClient = useQueryClient();
  const generation = useAuthStore((state) => state.generation);
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<{ commissioningDate: string }>({
    defaultValues: { commissioningDate: "" },
  });
  const commission = useMutation({
    mutationFn: (commissioningDate: string) =>
      assetsApi.commission(asset.id, asset.version, commissioningDate),
    onSuccess: async (updated) => {
      if (useAuthStore.getState().generation !== generation) return;
      queryClient.setQueryData(protectedQueryKey("asset", asset.id), updated);
      reset({ commissioningDate: "" });
      setMessage("Asset commissioned and moved to Active.");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("assets"),
        }),
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("asset-history", asset.id),
        }),
      ]);
    },
    onError: (error) => setMessage(authErrorMessage(error)),
  });

  const submit = handleSubmit(({ commissioningDate }) => {
    setMessage(null);
    clearErrors();
    const parsed = commissioningSchema.safeParse({ commissioningDate });
    if (!parsed.success) {
      setError("commissioningDate", {
        message: parsed.error.issues[0]?.message ?? "Choose a date.",
      });
      return;
    }
    commission.mutate(parsed.data.commissioningDate);
  });

  return (
    <section
      className="user-admin-card modern-form-card"
      aria-labelledby="commission-asset"
    >
      <div className="form-card-heading">
        <span className="form-step-mark" aria-hidden="true">
          AC
        </span>
        <div>
          <p className="eyebrow">Asset lifecycle</p>
          <h2 id="commission-asset">Commission asset</h2>
          <p>
            This named command moves a received asset to Active and records its
            commissioning calendar date.
          </p>
        </div>
      </div>
      {message && (
        <p
          className={commission.isError ? "form-error" : "form-notice"}
          role={commission.isError ? "alert" : "status"}
        >
          {message}
        </p>
      )}
      <form className="user-create-form modern-form" onSubmit={submit}>
        <div className="modern-form-grid master-live-form-grid">
          <div className="modern-field">
            <label htmlFor="asset-commissioning-date">Commissioning date</label>
            <input
              id="asset-commissioning-date"
              type="date"
              {...register("commissioningDate")}
              aria-invalid={Boolean(errors.commissioningDate)}
            />
            {errors.commissioningDate && (
              <span className="field-error" role="alert">
                {errors.commissioningDate.message}
              </span>
            )}
          </div>
        </div>
        <div className="modern-form-actions master-live-form-actions">
          <div>
            <strong>Version {asset.version}</strong>
            <small>
              The current version is checked before the lifecycle transition.
            </small>
          </div>
          <button
            className="button"
            disabled={commission.isPending}
            type="submit"
          >
            {commission.isPending ? "Commissioning…" : "Commission asset"}
          </button>
        </div>
      </form>
    </section>
  );
}
