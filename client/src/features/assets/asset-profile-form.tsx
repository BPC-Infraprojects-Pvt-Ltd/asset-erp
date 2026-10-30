import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { protectedQueryKey, useAuthStore } from "../auth/auth-store";
import {
  assetsApi,
  type Asset,
  type UpdateAssetProfileInput,
} from "./assets-api";
import {
  assetProfileError,
  assetProfileSchema,
  assetProfileValues,
  profileFields,
} from "./asset-profile";

export function AssetProfileForm({
  asset,
  reload,
}: {
  asset: Asset;
  reload: () => Promise<Asset>;
}) {
  const queryClient = useQueryClient();
  const generation = useAuthStore((state) => state.generation);
  const [version, setVersion] = useState(asset.version);
  const [error, setError] = useState<ReturnType<
    typeof assetProfileError
  > | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [saved, setSaved] = useState(false);
  const { register, handleSubmit, reset } = useForm<UpdateAssetProfileInput>({
    defaultValues: assetProfileValues(asset),
  });
  const update = useMutation({
    mutationFn: (input: UpdateAssetProfileInput) =>
      assetsApi.updateProfile(asset.id, version, input),
    onSuccess: async (updated) => {
      if (useAuthStore.getState().generation !== generation) return;
      reset(assetProfileValues(updated));
      setVersion(updated.version);
      setError(null);
      setReviewing(false);
      setSaved(true);
      queryClient.setQueryData(protectedQueryKey("asset", asset.id), updated);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("assets"),
        }),
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("asset", asset.id),
        }),
      ]);
    },
    onError: (failure) => {
      setError(assetProfileError(failure));
      setSaved(false);
    },
  });

  const submit = handleSubmit((values) => {
    if (
      update.isPending ||
      reloading ||
      error?.conflict ||
      error?.requiresReview
    )
      return;
    setSaved(false);
    const parsed = assetProfileSchema.safeParse(values);
    if (!parsed.success) {
      setError({
        conflict: false,
        requiresReview: false,
        message: parsed.error.issues[0]?.message ?? "Invalid profile.",
      });
      return;
    }
    const missingSpecification = asset.category.specificationFields.find(
      (field) =>
        field.required && !parsed.data.specifications[field.key]?.trim(),
    );
    if (missingSpecification) {
      setError({
        conflict: false,
        requiresReview: false,
        message: `${missingSpecification.label} is required for this category.`,
      });
      return;
    }
    setError(null);
    update.mutate(parsed.data);
  });

  async function reviewLatest() {
    setReloading(true);
    setSaved(false);
    setReviewing(false);
    try {
      const latest = await reload();
      if (useAuthStore.getState().generation !== generation) return;
      setReviewing(true);
      if (latest.version !== version) {
        setError({
          conflict: true,
          requiresReview: false,
          message:
            "This asset changed on the server. Your draft is kept. Review the latest profile, then explicitly discard your draft to edit the latest version. Nothing has been resubmitted.",
        });
      } else {
        setError(null);
      }
    } catch (failure) {
      const next = assetProfileError(failure);
      setError({
        ...next,
        conflict: error?.conflict ?? next.conflict,
        requiresReview: true,
      });
    } finally {
      setReloading(false);
    }
  }

  return (
    <section
      className="user-admin-card"
      aria-label="Edit descriptive asset profile"
    >
      <h2>Edit descriptive profile</h2>
      <p>
        Editing version {version}. Blank descriptive values clear a field.
        Category specification keys remain fixed.
      </p>
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <fieldset disabled={update.isPending || reloading}>
          <legend>Descriptive fields</legend>
          {profileFields.map((field) => (
            <label key={field.name} htmlFor={`profile-${field.name}`}>
              {field.label}
              {field.name === "notes" ? (
                <textarea
                  id={`profile-${field.name}`}
                  maxLength={field.maxLength}
                  {...register(field.name)}
                />
              ) : (
                <input
                  id={`profile-${field.name}`}
                  maxLength={field.maxLength}
                  type={"type" in field ? field.type : "text"}
                  {...register(field.name)}
                />
              )}
            </label>
          ))}
          <label htmlFor="profile-criticality">
            Criticality
            <select id="profile-criticality" {...register("criticality")}>
              <option value="">Not set</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </label>
          {asset.category.specificationFields.length > 0 && (
            <section className="asset-profile-specifications">
              <h3>Category specifications</h3>
              {asset.category.specificationFields.map((field) => (
                <label
                  key={field.key}
                  htmlFor={`profile-specification-${field.key}`}
                >
                  {field.label}
                  {field.required && <small>Required</small>}
                  <input
                    id={`profile-specification-${field.key}`}
                    maxLength={2000}
                    {...register(`specifications.${field.key}` as const)}
                  />
                </label>
              ))}
            </section>
          )}
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
            {error.message}
          </p>
        )}
        {saved && <p role="status">Profile saved.</p>}
        <button
          className="button button-primary"
          type="submit"
          disabled={
            update.isPending ||
            reloading ||
            error?.conflict ||
            error?.requiresReview
          }
        >
          {update.isPending ? "Saving…" : "Save profile"}
        </button>
        <button
          className="button"
          type="button"
          disabled={update.isPending || reloading}
          onClick={() => void reviewLatest()}
        >
          {reloading
            ? "Loading latest…"
            : "Load latest for review (keep draft)"}
        </button>
        {reviewing && (
          <section aria-label="Latest server profile">
            <h3>Latest server profile — version {asset.version}</h3>
            <dl>
              {profileFields.map((field) => (
                <div key={field.name}>
                  <dt>{field.label}</dt>
                  <dd>{asset[field.name] ?? "—"}</dd>
                </div>
              ))}
              {asset.category.specificationFields.map((field) => (
                <div key={field.key}>
                  <dt>{field.label}</dt>
                  <dd>{asset.specifications?.[field.key] ?? "—"}</dd>
                </div>
              ))}
            </dl>
            <button
              className="button"
              type="button"
              disabled={update.isPending || reloading}
              onClick={() => {
                reset(assetProfileValues(asset));
                setVersion(asset.version);
                setError(null);
                setSaved(false);
                setReviewing(false);
              }}
            >
              Discard my draft and edit latest version
            </button>
          </section>
        )}
      </form>
    </section>
  );
}
