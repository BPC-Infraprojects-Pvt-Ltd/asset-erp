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
        <section className="user-admin-card" aria-labelledby="create-location">
          <h2 id="create-location">Create location</h2>
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
          <form className="user-create-form" onSubmit={createLocationForm}>
            <label htmlFor="location-code">Code</label>
            <input id="location-code" {...registerLocation("code")} />
            {locationErrors.code && (
              <span className="field-error">{locationErrors.code.message}</span>
            )}
            <label htmlFor="location-name">Name</label>
            <input id="location-name" {...registerLocation("name")} />
            {locationErrors.name && (
              <span className="field-error">{locationErrors.name.message}</span>
            )}
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
            <button
              className="button"
              disabled={createLocation.isPending}
              type="submit"
            >
              Create location
            </button>
          </form>
        </section>
      )}

      {isAdministrator && (
        <section className="user-admin-card" aria-labelledby="create-store">
          <h2 id="create-store">Create store</h2>
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
          <form className="user-create-form" onSubmit={createStoreForm}>
            <label htmlFor="store-code">Code</label>
            <input id="store-code" {...registerStore("code")} />
            {storeErrors.code && (
              <span className="field-error">{storeErrors.code.message}</span>
            )}
            <label htmlFor="store-name">Name</label>
            <input id="store-name" {...registerStore("name")} />
            {storeErrors.name && (
              <span className="field-error">{storeErrors.name.message}</span>
            )}
            <label htmlFor="store-location">Location</label>
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
            <button
              className="button"
              disabled={createStore.isPending || !locationsQuery.data?.length}
              type="submit"
            >
              Create store
            </button>
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
