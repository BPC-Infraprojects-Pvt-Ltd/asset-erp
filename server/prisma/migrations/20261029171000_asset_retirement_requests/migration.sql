ALTER TYPE "AssetHistoryEventType" ADD VALUE 'RETIREMENT_REQUESTED';

CREATE TYPE "RetirementRequestStatus" AS ENUM ('PENDING_REVIEW');

CREATE TABLE "retirement_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "impact_review" VARCHAR(2000) NOT NULL,
    "status" "RetirementRequestStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "version" INTEGER NOT NULL DEFAULT 1,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "retirement_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "retirement_requests_version_positive_check" CHECK ("version" > 0),
    CONSTRAINT "retirement_requests_reason_nonempty_check" CHECK (length(btrim("reason")) > 0),
    CONSTRAINT "retirement_requests_impact_nonempty_check" CHECK (length(btrim("impact_review")) > 0)
);

CREATE UNIQUE INDEX "retirement_requests_organization_id_id_key"
    ON "retirement_requests"("organization_id", "id");
CREATE UNIQUE INDEX "retirement_requests_org_asset_key"
    ON "retirement_requests"("organization_id", "asset_id");
CREATE UNIQUE INDEX "retirement_requests_submitter_idempotency_key"
    ON "retirement_requests"("organization_id", "requested_by_user_id", "idempotency_key");
CREATE INDEX "retirement_requests_org_status_created_idx"
    ON "retirement_requests"("organization_id", "status", "created_at");

ALTER TABLE "retirement_requests"
    ADD CONSTRAINT "retirement_requests_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "retirement_requests"
    ADD CONSTRAINT "retirement_requests_organization_id_asset_id_fkey"
    FOREIGN KEY ("organization_id", "asset_id")
    REFERENCES "assets"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "retirement_requests"
    ADD CONSTRAINT "retirement_requests_organization_id_requested_by_user_id_fkey"
    FOREIGN KEY ("organization_id", "requested_by_user_id")
    REFERENCES "users"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
