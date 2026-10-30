import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";
import { authErrorMessage } from "../auth/auth-errors";
import { protectedQueryKey, useAuthStore } from "../auth/auth-store";
import {
  locationsApi,
  type CreateLocationInput,
  type CreateStoreInput,
} from "./locations-api";

const locationSchema = z.object({
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(150),
  parentLocationId: z.string().optional(),
});

const storeSchema = z.object({
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(150),
  locationId: z.string().uuid(),
});

export function LocationsPage() {
  const queryClient = useQueryClient();
  const isAdministrator =
    useAuthStore((state) => state.session?.user.role) === "ADMINISTRATOR";
  const locationsQuery = useQuery({
    queryKey: protectedQueryKey("locations"),
    queryFn: locationsApi.list,
  });
  const storesQuery = useQuery({
    queryKey: protectedQueryKey("stores"),
    queryFn: locationsApi.listStores,
  });
  const createLocation = useMutation({
    mutationFn: locationsApi.create,
    onSuccess: async () => {
      resetLocation();
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("locations"),
        }),
        queryClient.invalidateQueries({
          queryKey: protectedQueryKey("stores"),
        }),
      ]);
    },
  });
  const createStore = useMutation({
    mutationFn: locationsApi.createStore,
    onSuccess: async () => {
      resetStore();
      await queryClient.invalidateQueries({
        queryKey: protectedQueryKey("stores"),
      });
    },
  });
  const {
    register: registerLocation,
    handleSubmit: handleLocationSubmit,
    reset: resetLocation,
    formState: { errors: locationErrors },
  } = useForm<CreateLocationInput>({
    defaultValues: { code: "", name: "", parentLocationId: "" },
  });
  const {
    register: registerStore,
    handleSubmit: handleStoreSubmit,
    reset: resetStore,
    formState: { errors: storeErrors },
  } = useForm<CreateStoreInput>({
    defaultValues: { code: "", name: "", locationId: "" },
  });
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [storeMessage, setStoreMessage] = useState<string | null>(null);

  const createLocationForm = handleLocationSubmit((values) => {
    setLocationMessage(null);
    const parsed = locationSchema.safeParse(values);
    if (!parsed.success) {
      setLocationMessage(
        parsed.error.issues[0]?.message ?? "Invalid location.",
      );
      return;
    }
    createLocation.mutate({
      ...parsed.data,
      parentLocationId: parsed.data.parentLocationId || undefined,
    });
  });
  const createStoreForm = handleStoreSubmit((values) => {
    setStoreMessage(null);
    const parsed = storeSchema.safeParse(values);
    if (!parsed.success) {
      setStoreMessage(parsed.error.issues[0]?.message ?? "Invalid store.");
      return;
    }
    createStore.mutate(parsed.data);
  });

  return (
    <section>
      <div className="page-heading">
        <p className="eyebrow">Administration</p>
        <h1>Locations and stores</h1>
        <p className="page-description">
          Organize the approved parent/child Location hierarchy with Stores
          attached to a Location. A location-scope grant includes descendants
          and their Stores.
        </p>
      </div>

      {isAdministrator && (
        <section
          className="user-admin-card modern-form-card"
          aria-labelledby="create-location"
        >
          <div className="form-card-heading">
            <span className="form-step-mark" aria-hidden="true">
              01
            </span>
            <div>
              <p className="eyebrow">Organization structure</p>
              <h2 id="create-location">Create location</h2>
              <p>
                Add a parent or child location in the organization hierarchy.
              </p>
            </div>
          </div>
          {locationMessage && (
            <p className="form-error" role="alert">
              {locationMessage}
            </p>
          )}
          {createLocation.isError && (
            <p className="form-error" role="alert">
              {authErrorMessage(createLocation.error)}
            </p>
          )}
          <form
            className="user-create-form modern-form"
            onSubmit={createLocationForm}
          >
            <div className="modern-form-grid">
              <div className="modern-field">
                <label htmlFor="location-code">Location code</label>
                <input
                  id="location-code"
                  placeholder="e.g. PUNE-HQ"
                  {...registerLocation("code")}
                />
                <small>Use a stable code for lists and references.</small>
                {locationErrors.code && (
                  <span className="field-error">
                    {locationErrors.code.message}
                  </span>
                )}
              </div>
              <div className="modern-field">
                <label htmlFor="location-name">Location name</label>
                <input
                  id="location-name"
                  placeholder="e.g. Pune headquarters"
                  {...registerLocation("name")}
                />
                {locationErrors.name && (
                  <span className="field-error">
                    {locationErrors.name.message}
                  </span>
                )}
              </div>
              <div className="modern-field modern-field-wide">
                <label htmlFor="location-parent">Parent location</label>
                <select
                  id="location-parent"
                  {...registerLocation("parentLocationId")}
                >
                  <option value="">Top-level location</option>
                  {locationsQuery.data?.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.code} — {location.name}
                    </option>
                  ))}
                </select>
                <small>
                  Choose a parent to create a child location, or leave this
                  empty for a top-level location.
                </small>
              </div>
            </div>
            <div className="modern-form-actions">
              <button
                className="button"
                disabled={createLocation.isPending}
                type="submit"
              >
                {createLocation.isPending ? "Creating…" : "Create location"}
              </button>
            </div>
          </form>
        </section>
      )}

      {isAdministrator && (
        <section
          className="user-admin-card modern-form-card"
          aria-labelledby="create-store"
        >
          <div className="form-card-heading">
            <span className="form-step-mark" aria-hidden="true">
              02
            </span>
            <div>
              <p className="eyebrow">Storage location</p>
              <h2 id="create-store">Create store</h2>
              <p>
                Attach a store to one location. Location grants include its
                stores and descendants.
              </p>
            </div>
          </div>
          {storeMessage && (
            <p className="form-error" role="alert">
              {storeMessage}
            </p>
          )}
          {createStore.isError && (
            <p className="form-error" role="alert">
              {authErrorMessage(createStore.error)}
            </p>
          )}
          <form
            className="user-create-form modern-form"
            onSubmit={createStoreForm}
          >
            <div className="modern-form-grid">
              <div className="modern-field">
                <label htmlFor="store-code">Store code</label>
                <input
                  id="store-code"
                  placeholder="e.g. PUNE-IT-STORE"
                  {...registerStore("code")}
                />
                <small>Keep the store identifier short and recognizable.</small>
                {storeErrors.code && (
                  <span className="field-error">
                    {storeErrors.code.message}
                  </span>
                )}
              </div>
              <div className="modern-field">
                <label htmlFor="store-name">Store name</label>
                <input
                  id="store-name"
                  placeholder="e.g. IT equipment store"
                  {...registerStore("name")}
                />
                {storeErrors.name && (
                  <span className="field-error">
                    {storeErrors.name.message}
                  </span>
                )}
              </div>
              <div className="modern-field modern-field-wide">
                <label htmlFor="store-location">Attached location</label>
                <select id="store-location" {...registerStore("locationId")}>
                  <option value="">Select a location</option>
                  {locationsQuery.data?.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.code} — {location.name}
                    </option>
                  ))}
                </select>
                {storeErrors.locationId && (
                  <span className="field-error">
                    {storeErrors.locationId.message}
                  </span>
                )}
              </div>
            </div>
            <div className="modern-form-actions">
              <button
                className="button"
                disabled={createStore.isPending || !locationsQuery.data?.length}
                type="submit"
              >
                {createStore.isPending ? "Creating…" : "Create store"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="user-admin-card" aria-labelledby="location-list">
        <h2 id="location-list">Locations</h2>
        {locationsQuery.isError && (
          <p className="form-error" role="alert">
            {authErrorMessage(locationsQuery.error)}
          </p>
        )}
        {locationsQuery.isPending ? (
          <p role="status">Loading locations…</p>
        ) : locationsQuery.data?.length ? (
          <ul className="master-list">
            {locationsQuery.data.map((location) => {
              const parent = locationsQuery.data.find(
                (item) => item.id === location.parentLocationId,
              );
              return (
                <li key={location.id}>
                  <strong>{location.code}</strong> — {location.name}
                  {parent && (
                    <span className="master-list-parent">
                      {" "}
                      under {parent.code}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p>No locations have been created.</p>
        )}
      </section>

      <section className="user-admin-card" aria-labelledby="store-list">
        <h2 id="store-list">Stores</h2>
        {storesQuery.isError && (
          <p className="form-error" role="alert">
            {authErrorMessage(storesQuery.error)}
          </p>
        )}
        {storesQuery.isPending ? (
          <p role="status">Loading stores…</p>
        ) : storesQuery.data?.length ? (
          <ul className="master-list">
            {storesQuery.data.map((store) => (
              <li key={store.id}>
                <strong>{store.code}</strong> — {store.name}
                <span className="master-list-parent">
                  {" "}
                  at {store.location.code}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No stores have been created.</p>
        )}
      </section>
    </section>
  );
}
