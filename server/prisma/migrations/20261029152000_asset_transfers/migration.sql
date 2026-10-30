ALTER TYPE "AssetHistoryEventType" ADD VALUE 'TRANSFER_DISPATCHED';
ALTER TYPE "AssetHistoryEventType" ADD VALUE 'TRANSFER_RECEIVED';
ALTER TYPE "AssetHistoryEventType" ADD VALUE 'TRANSFER_EXCEPTION';
CREATE TYPE "AssetTransferStatus" AS ENUM ('DRAFT', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');
CREATE TYPE "AssetTransferLineStatus" AS ENUM ('DRAFT', 'IN_TRANSIT', 'RECEIVED', 'MISSING', 'REJECTED', 'CANCELLED');

CREATE TABLE "asset_transfers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "source_location_id" UUID NOT NULL,
    "destination_location_id" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "status" "AssetTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "requested_by_user_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "dispatched_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "asset_transfers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "asset_transfers_different_locations_check"
        CHECK ("source_location_id" <> "destination_location_id"),
    CONSTRAINT "asset_transfers_version_positive_check"
        CHECK ("version" > 0)
);

CREATE TABLE "asset_transfer_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "transfer_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "asset_version_at_create" INTEGER NOT NULL,
    "asset_version_at_dispatch" INTEGER,
    "status" "AssetTransferLineStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "received_at" TIMESTAMPTZ(3),
    "received_by_user_id" UUID,
    "condition_at_receipt" "AssetCondition",
    "inspection_required" BOOLEAN,
    "exception_note" VARCHAR(1000),
    "receipt_idempotency_key" VARCHAR(100),
    "receipt_payload_hash" CHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "asset_transfer_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "asset_transfer_lines_version_positive_check"
        CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "asset_transfers_organization_id_id_key"
    ON "asset_transfers"("organization_id", "id");
CREATE UNIQUE INDEX "asset_transfers_org_requester_key_key"
    ON "asset_transfers"("organization_id", "requested_by_user_id", "idempotency_key");
CREATE INDEX "asset_transfers_org_source_created_idx"
    ON "asset_transfers"("organization_id", "source_location_id", "created_at");
CREATE INDEX "asset_transfers_org_destination_status_idx"
    ON "asset_transfers"("organization_id", "destination_location_id", "status");

CREATE UNIQUE INDEX "asset_transfer_lines_organization_id_id_key"
    ON "asset_transfer_lines"("organization_id", "id");
CREATE UNIQUE INDEX "asset_transfer_lines_org_transfer_asset_key"
    ON "asset_transfer_lines"("organization_id", "transfer_id", "asset_id");
CREATE UNIQUE INDEX "asset_transfer_lines_active_asset_key"
    ON "asset_transfer_lines"("organization_id", "asset_id")
    WHERE "status" IN ('DRAFT', 'IN_TRANSIT', 'MISSING', 'REJECTED');
CREATE INDEX "asset_transfer_lines_org_asset_status_idx"
    ON "asset_transfer_lines"("organization_id", "asset_id", "status");

ALTER TABLE "asset_transfers"
    ADD CONSTRAINT "asset_transfers_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_transfers"
    ADD CONSTRAINT "asset_transfers_organization_id_source_location_id_fkey"
    FOREIGN KEY ("organization_id", "source_location_id")
    REFERENCES "locations"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_transfers"
    ADD CONSTRAINT "asset_transfers_organization_id_destination_location_id_fkey"
    FOREIGN KEY ("organization_id", "destination_location_id")
    REFERENCES "locations"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_transfers"
    ADD CONSTRAINT "asset_transfers_organization_id_requested_by_user_id_fkey"
    FOREIGN KEY ("organization_id", "requested_by_user_id")
    REFERENCES "users"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_transfer_lines"
    ADD CONSTRAINT "asset_transfer_lines_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_transfer_lines"
    ADD CONSTRAINT "asset_transfer_lines_organization_id_transfer_id_fkey"
    FOREIGN KEY ("organization_id", "transfer_id")
    REFERENCES "asset_transfers"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_transfer_lines"
    ADD CONSTRAINT "asset_transfer_lines_organization_id_asset_id_fkey"
    FOREIGN KEY ("organization_id", "asset_id")
    REFERENCES "assets"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_transfer_lines"
    ADD CONSTRAINT "asset_transfer_lines_organization_id_received_by_user_id_fkey"
    FOREIGN KEY ("organization_id", "received_by_user_id")
    REFERENCES "users"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
