ALTER TYPE "AssetHistoryEventType" ADD VALUE 'VERIFICATION_RECONCILED';

CREATE TYPE "VerificationCampaignStatus" AS ENUM (
    'OPEN',
    'COMPLETED'
);

CREATE TYPE "VerificationObservationResult" AS ENUM (
    'VERIFIED',
    'MISSING',
    'MISPLACED',
    'TAG_MISMATCH',
    'DAMAGED',
    'DISPUTED',
    'UNEXPECTED',
    'DUPLICATE'
);

CREATE TYPE "VerificationObservationResolution" AS ENUM (
    'PENDING',
    'RECONCILED',
    'DISMISSED'
);

CREATE TABLE "verification_campaigns" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "status" "VerificationCampaignStatus" NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_user_id" UUID NOT NULL,
    "create_idempotency_key" VARCHAR(100) NOT NULL,
    "create_payload_hash" CHAR(64) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "completed_by_user_id" UUID,
    "completion_idempotency_key" VARCHAR(100),
    "completion_payload_hash" CHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "verification_campaigns_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "verification_campaigns_version_positive_check" CHECK ("version" > 0),
    CONSTRAINT "verification_campaigns_lifecycle_fields_check" CHECK (
        ("status" = 'OPEN' AND "completed_at" IS NULL AND "completed_by_user_id" IS NULL AND "completion_idempotency_key" IS NULL AND "completion_payload_hash" IS NULL)
        OR ("status" = 'COMPLETED' AND "completed_at" IS NOT NULL AND "completed_by_user_id" IS NOT NULL AND "completion_idempotency_key" IS NOT NULL AND "completion_payload_hash" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "verification_campaigns_organization_id_id_key"
    ON "verification_campaigns"("organization_id", "id");
CREATE UNIQUE INDEX "verification_campaigns_creator_idempotency_key"
    ON "verification_campaigns"("organization_id", "created_by_user_id", "create_idempotency_key");
CREATE UNIQUE INDEX "verification_campaigns_completer_idempotency_key"
    ON "verification_campaigns"("organization_id", "completed_by_user_id", "completion_idempotency_key");
CREATE INDEX "verification_campaigns_org_location_status_idx"
    ON "verification_campaigns"("organization_id", "location_id", "status", "created_at");

ALTER TABLE "verification_campaigns"
    ADD CONSTRAINT "verification_campaigns_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_campaigns"
    ADD CONSTRAINT "verification_campaigns_organization_id_location_id_fkey"
    FOREIGN KEY ("organization_id", "location_id")
    REFERENCES "locations"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_campaigns"
    ADD CONSTRAINT "verification_campaigns_organization_id_created_by_user_id_fkey"
    FOREIGN KEY ("organization_id", "created_by_user_id")
    REFERENCES "users"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_campaigns"
    ADD CONSTRAINT "verification_campaigns_organization_id_completed_by_user_id_fkey"
    FOREIGN KEY ("organization_id", "completed_by_user_id")
    REFERENCES "users"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "verification_campaign_assets" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "expected_asset_tag" VARCHAR(100) NOT NULL,
    "expected_location_id" UUID NOT NULL,
    "expected_location_code" VARCHAR(60) NOT NULL,
    "expected_location_name" VARCHAR(150) NOT NULL,
    "expected_category_code" VARCHAR(60) NOT NULL,
    "expected_category_name" VARCHAR(150) NOT NULL,
    "expected_lifecycle" "AssetLifecycle" NOT NULL,
    "expected_condition" "AssetCondition" NOT NULL,
    "expected_asset_version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "verification_campaign_assets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "verification_campaign_assets_version_check" CHECK ("expected_asset_version" > 0)
);

CREATE UNIQUE INDEX "verification_campaign_assets_organization_id_id_key"
    ON "verification_campaign_assets"("organization_id", "id");
CREATE UNIQUE INDEX "verification_campaign_assets_campaign_asset_key"
    ON "verification_campaign_assets"("organization_id", "campaign_id", "asset_id");
CREATE INDEX "verification_campaign_assets_campaign_tag_idx"
    ON "verification_campaign_assets"("organization_id", "campaign_id", "expected_asset_tag");

ALTER TABLE "verification_campaign_assets"
    ADD CONSTRAINT "verification_campaign_assets_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_campaign_assets"
    ADD CONSTRAINT "verification_campaign_assets_organization_id_campaign_id_fkey"
    FOREIGN KEY ("organization_id", "campaign_id")
    REFERENCES "verification_campaigns"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_campaign_assets"
    ADD CONSTRAINT "verification_campaign_assets_organization_id_asset_id_fkey"
    FOREIGN KEY ("organization_id", "asset_id")
    REFERENCES "assets"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_campaign_assets"
    ADD CONSTRAINT "verification_campaign_assets_organization_id_expected_location_id_fkey"
    FOREIGN KEY ("organization_id", "expected_location_id")
    REFERENCES "locations"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "verification_observations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "expected_asset_id" UUID,
    "observed_asset_id" UUID,
    "observed_tag" VARCHAR(100),
    "observed_location_id" UUID,
    "observed_custodian_id" UUID,
    "observed_condition" "AssetCondition",
    "result" "VerificationObservationResult" NOT NULL,
    "notes" VARCHAR(2000),
    "observed_by_user_id" UUID NOT NULL,
    "observed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "resolution" "VerificationObservationResolution" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "reconciled_by_user_id" UUID,
    "reconciled_at" TIMESTAMPTZ(3),
    "resolution_idempotency_key" VARCHAR(100),
    "resolution_payload_hash" CHAR(64),
    "resolution_note" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "verification_observations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "verification_observations_version_positive_check" CHECK ("version" > 0),
    CONSTRAINT "verification_observations_identity_check" CHECK (
        ("expected_asset_id" IS NOT NULL AND "result" <> 'UNEXPECTED')
        OR ("expected_asset_id" IS NULL AND "result" IN ('UNEXPECTED', 'DUPLICATE'))
    ),
    CONSTRAINT "verification_observations_resolution_fields_check" CHECK (
        ("resolution" = 'PENDING' AND "reconciled_by_user_id" IS NULL AND "reconciled_at" IS NULL AND "resolution_idempotency_key" IS NULL AND "resolution_payload_hash" IS NULL)
        OR ("resolution" <> 'PENDING' AND "reconciled_by_user_id" IS NOT NULL AND "reconciled_at" IS NOT NULL AND "resolution_idempotency_key" IS NOT NULL AND "resolution_payload_hash" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "verification_observations_organization_id_id_key"
    ON "verification_observations"("organization_id", "id");
CREATE UNIQUE INDEX "verification_observations_actor_idempotency_key"
    ON "verification_observations"("organization_id", "observed_by_user_id", "idempotency_key");
CREATE UNIQUE INDEX "verification_observations_reconciler_idempotency_key"
    ON "verification_observations"("organization_id", "reconciled_by_user_id", "resolution_idempotency_key");
CREATE INDEX "verification_observations_campaign_time_idx"
    ON "verification_observations"("organization_id", "campaign_id", "observed_at");
CREATE INDEX "verification_observations_expected_time_idx"
    ON "verification_observations"("organization_id", "expected_asset_id", "observed_at");

ALTER TABLE "verification_observations"
    ADD CONSTRAINT "verification_observations_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_observations"
    ADD CONSTRAINT "verification_observations_organization_id_campaign_id_fkey"
    FOREIGN KEY ("organization_id", "campaign_id")
    REFERENCES "verification_campaigns"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_observations"
    ADD CONSTRAINT "verification_observations_organization_id_expected_asset_id_fkey"
    FOREIGN KEY ("organization_id", "expected_asset_id")
    REFERENCES "verification_campaign_assets"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_observations"
    ADD CONSTRAINT "verification_observations_organization_id_observed_asset_id_fkey"
    FOREIGN KEY ("organization_id", "observed_asset_id")
    REFERENCES "assets"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_observations"
    ADD CONSTRAINT "verification_observations_organization_id_observed_location_id_fkey"
    FOREIGN KEY ("organization_id", "observed_location_id")
    REFERENCES "locations"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_observations"
    ADD CONSTRAINT "verification_observations_organization_id_observed_custodian_id_fkey"
    FOREIGN KEY ("organization_id", "observed_custodian_id")
    REFERENCES "employees"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_observations"
    ADD CONSTRAINT "verification_observations_organization_id_observed_by_user_id_fkey"
    FOREIGN KEY ("organization_id", "observed_by_user_id")
    REFERENCES "users"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_observations"
    ADD CONSTRAINT "verification_observations_organization_id_reconciled_by_user_id_fkey"
    FOREIGN KEY ("organization_id", "reconciled_by_user_id")
    REFERENCES "users"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
