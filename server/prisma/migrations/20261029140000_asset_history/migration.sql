CREATE TYPE "AssetHistoryEventType" AS ENUM ('REGISTERED', 'PROFILE_UPDATED');

CREATE TABLE "asset_history_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "event_type" "AssetHistoryEventType" NOT NULL,
    "details" JSONB,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_history_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "asset_history_events_organization_id_id_key"
    ON "asset_history_events"("organization_id", "id");
CREATE INDEX "asset_history_events_org_asset_time_idx"
    ON "asset_history_events"("organization_id", "asset_id", "occurred_at", "id");

ALTER TABLE "asset_history_events"
    ADD CONSTRAINT "asset_history_events_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_history_events"
    ADD CONSTRAINT "asset_history_events_organization_id_asset_id_fkey"
    FOREIGN KEY ("organization_id", "asset_id")
    REFERENCES "assets"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_history_events"
    ADD CONSTRAINT "asset_history_events_organization_id_actor_user_id_fkey"
    FOREIGN KEY ("organization_id", "actor_user_id")
    REFERENCES "users"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
