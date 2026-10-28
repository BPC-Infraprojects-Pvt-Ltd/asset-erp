-- Lifecycle changes require a later workflow migration; this slice registers received assets only.
CREATE TYPE "AssetLifecycle" AS ENUM ('RECEIVED', 'ACTIVE', 'RETIRED', 'DISPOSED');
CREATE TYPE "AssetAvailability" AS ENUM ('AVAILABLE', 'RESERVED', 'ASSIGNED', 'IN_TRANSIT', 'IN_REPAIR', 'QUARANTINED', 'UNAVAILABLE');
CREATE TYPE "AssetCondition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'DAMAGED', 'NONFUNCTIONAL', 'UNKNOWN');
CREATE TYPE "AssetVerification" AS ENUM ('VERIFIED', 'MISSING', 'DISPUTED', 'NOT_CHECKED');

CREATE TABLE "asset_categories" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "asset_tag" VARCHAR(100) NOT NULL,
    "category_id" UUID NOT NULL,
    "manufacturer" VARCHAR(150),
    "model" VARCHAR(150),
    "serial_number" VARCHAR(150),
    "location_id" UUID NOT NULL,
    "lifecycle" "AssetLifecycle" NOT NULL DEFAULT 'RECEIVED',
    "availability" "AssetAvailability" NOT NULL,
    "condition" "AssetCondition" NOT NULL,
    "verification" "AssetVerification" NOT NULL DEFAULT 'NOT_CHECKED',
    "source_reference" VARCHAR(150),
    "notes" VARCHAR(2000),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "assets_received_initial_state_check" CHECK (
        "lifecycle" = 'RECEIVED' AND
        "availability" IN ('AVAILABLE', 'QUARANTINED', 'UNAVAILABLE')
    ),
    CONSTRAINT "assets_nonfunctional_state_check" CHECK (
        "condition" <> 'NONFUNCTIONAL' OR
        "availability" IN ('IN_REPAIR', 'QUARANTINED', 'UNAVAILABLE')
    ),
    CONSTRAINT "assets_version_positive_check" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "asset_categories_organization_id_id_key"
    ON "asset_categories"("organization_id", "id");
CREATE UNIQUE INDEX "asset_categories_organization_id_code_key"
    ON "asset_categories"("organization_id", "code");
CREATE INDEX "asset_categories_org_active_code_idx"
    ON "asset_categories"("organization_id", "is_active", "code");

CREATE UNIQUE INDEX "assets_organization_id_id_key"
    ON "assets"("organization_id", "id");
CREATE UNIQUE INDEX "assets_organization_id_asset_tag_key"
    ON "assets"("organization_id", "asset_tag");
CREATE INDEX "assets_org_created_at_id_idx"
    ON "assets"("organization_id", "created_at", "id");
CREATE INDEX "assets_org_location_created_idx"
    ON "assets"("organization_id", "location_id", "created_at");
CREATE INDEX "assets_org_category_created_idx"
    ON "assets"("organization_id", "category_id", "created_at");
CREATE INDEX "assets_org_lifecycle_availability_idx"
    ON "assets"("organization_id", "lifecycle", "availability");

ALTER TABLE "asset_categories"
    ADD CONSTRAINT "asset_categories_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "assets"
    ADD CONSTRAINT "assets_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assets"
    ADD CONSTRAINT "assets_organization_id_category_id_fkey"
    FOREIGN KEY ("organization_id", "category_id")
    REFERENCES "asset_categories"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assets"
    ADD CONSTRAINT "assets_organization_id_location_id_fkey"
    FOREIGN KEY ("organization_id", "location_id")
    REFERENCES "locations"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assets"
    ADD CONSTRAINT "assets_organization_id_created_by_user_id_fkey"
    FOREIGN KEY ("organization_id", "created_by_user_id")
    REFERENCES "users"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
