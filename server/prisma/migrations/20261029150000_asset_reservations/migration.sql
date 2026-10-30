ALTER TYPE "AssetHistoryEventType" ADD VALUE 'RESERVATION_CREATED';
ALTER TYPE "AssetHistoryEventType" ADD VALUE 'RESERVATION_CANCELLED';

CREATE TABLE "asset_reservations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "expires_on" DATE NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "cancelled_by_user_id" UUID,
    "cancelled_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "asset_reservations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "asset_reservations_dates_check"
        CHECK ("start_date" <= "expires_on"),
    CONSTRAINT "asset_reservations_cancel_actor_check"
        CHECK (("cancelled_at" IS NULL) = ("cancelled_by_user_id" IS NULL)),
    CONSTRAINT "asset_reservations_version_positive_check"
        CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "asset_reservations_organization_id_id_key"
    ON "asset_reservations"("organization_id", "id");
CREATE UNIQUE INDEX "asset_reservations_org_actor_key_key"
    ON "asset_reservations"("organization_id", "created_by_user_id", "idempotency_key");
CREATE INDEX "asset_reservations_org_asset_dates_idx"
    ON "asset_reservations"("organization_id", "asset_id", "start_date", "expires_on");
CREATE INDEX "asset_reservations_org_employee_start_idx"
    ON "asset_reservations"("organization_id", "employee_id", "start_date");

ALTER TABLE "asset_reservations"
    ADD CONSTRAINT "asset_reservations_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_reservations"
    ADD CONSTRAINT "asset_reservations_organization_id_asset_id_fkey"
    FOREIGN KEY ("organization_id", "asset_id")
    REFERENCES "assets"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_reservations"
    ADD CONSTRAINT "asset_reservations_organization_id_employee_id_fkey"
    FOREIGN KEY ("organization_id", "employee_id")
    REFERENCES "employees"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_reservations"
    ADD CONSTRAINT "asset_reservations_organization_id_created_by_user_id_fkey"
    FOREIGN KEY ("organization_id", "created_by_user_id")
    REFERENCES "users"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_reservations"
    ADD CONSTRAINT "asset_reservations_organization_id_cancelled_by_user_id_fkey"
    FOREIGN KEY ("organization_id", "cancelled_by_user_id")
    REFERENCES "users"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
