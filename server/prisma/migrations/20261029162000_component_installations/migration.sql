ALTER TYPE "AssetHistoryEventType" ADD VALUE 'COMPONENT_INSTALLED';
ALTER TYPE "AssetHistoryEventType" ADD VALUE 'COMPONENT_REMOVED';

CREATE TABLE "component_installations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "host_asset_id" UUID NOT NULL,
    "component_asset_id" UUID NOT NULL,
    "installed_by_user_id" UUID NOT NULL,
    "installed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "install_note" VARCHAR(1000),
    "install_idempotency_key" VARCHAR(100) NOT NULL,
    "install_payload_hash" CHAR(64) NOT NULL,
    "removed_by_user_id" UUID,
    "removed_at" TIMESTAMPTZ(3),
    "removal_note" VARCHAR(1000),
    "removal_idempotency_key" VARCHAR(100),
    "removal_payload_hash" CHAR(64),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "component_installations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "component_installations_different_assets_check"
        CHECK ("host_asset_id" <> "component_asset_id"),
    CONSTRAINT "component_installations_version_positive_check"
        CHECK ("version" > 0),
    CONSTRAINT "component_installations_removal_fields_check"
        CHECK (("removed_at" IS NULL AND "removed_by_user_id" IS NULL AND "removal_idempotency_key" IS NULL AND "removal_payload_hash" IS NULL)
            OR ("removed_at" IS NOT NULL AND "removed_by_user_id" IS NOT NULL AND "removal_idempotency_key" IS NOT NULL AND "removal_payload_hash" IS NOT NULL))
);

CREATE UNIQUE INDEX "component_installations_organization_id_id_key"
    ON "component_installations"("organization_id", "id");
CREATE UNIQUE INDEX "component_installations_org_installer_key_key"
    ON "component_installations"("organization_id", "installed_by_user_id", "install_idempotency_key");
CREATE UNIQUE INDEX "component_installations_org_remover_key_key"
    ON "component_installations"("organization_id", "removed_by_user_id", "removal_idempotency_key");
CREATE UNIQUE INDEX "component_installations_open_component_key"
    ON "component_installations"("organization_id", "component_asset_id")
    WHERE "removed_at" IS NULL;
CREATE INDEX "component_installations_org_host_time_idx"
    ON "component_installations"("organization_id", "host_asset_id", "installed_at");
CREATE INDEX "component_installations_org_component_open_idx"
    ON "component_installations"("organization_id", "component_asset_id", "removed_at");

ALTER TABLE "component_installations"
    ADD CONSTRAINT "component_installations_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "component_installations"
    ADD CONSTRAINT "component_installations_organization_id_host_asset_id_fkey"
    FOREIGN KEY ("organization_id", "host_asset_id")
    REFERENCES "assets"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "component_installations"
    ADD CONSTRAINT "component_installations_organization_id_component_asset_id_fkey"
    FOREIGN KEY ("organization_id", "component_asset_id")
    REFERENCES "assets"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "component_installations"
    ADD CONSTRAINT "component_installations_organization_id_installed_by_user_id_fkey"
    FOREIGN KEY ("organization_id", "installed_by_user_id")
    REFERENCES "users"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "component_installations"
    ADD CONSTRAINT "component_installations_organization_id_removed_by_user_id_fkey"
    FOREIGN KEY ("organization_id", "removed_by_user_id")
    REFERENCES "users"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
