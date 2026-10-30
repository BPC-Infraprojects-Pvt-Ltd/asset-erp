ALTER TYPE "AssetHistoryEventType" ADD VALUE 'ASSIGNED';
ALTER TYPE "AssetHistoryEventType" ADD VALUE 'RETURNED';
CREATE TYPE "AssignmentRecipientType" AS ENUM ('EMPLOYEE', 'TEAM', 'SHARED_POOL');

CREATE TABLE "asset_assignments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "recipient_type" "AssignmentRecipientType" NOT NULL,
    "employee_id" UUID,
    "recipient_label" VARCHAR(160),
    "issued_by_user_id" UUID NOT NULL,
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expected_return_date" DATE,
    "condition_at_issue" "AssetCondition" NOT NULL,
    "accessories_at_issue" VARCHAR(1000),
    "purpose" VARCHAR(500) NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "acknowledged_at" TIMESTAMPTZ(3),
    "returned_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "asset_assignments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "asset_assignments_recipient_check"
        CHECK (
            ("recipient_type" = 'EMPLOYEE' AND "employee_id" IS NOT NULL AND "recipient_label" IS NULL)
            OR
            ("recipient_type" IN ('TEAM', 'SHARED_POOL') AND "employee_id" IS NULL AND NULLIF(BTRIM("recipient_label"), '') IS NOT NULL)
        ),
    CONSTRAINT "asset_assignments_version_positive_check"
        CHECK ("version" > 0)
);

CREATE TABLE "asset_returns" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "received_by_user_id" UUID NOT NULL,
    "returned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "condition_at_return" "AssetCondition" NOT NULL,
    "accessories_returned" VARCHAR(1000),
    "missing_items" VARCHAR(1000),
    "follow_up" VARCHAR(1000),
    "inspection_required" BOOLEAN NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_returns_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "asset_assignments_organization_id_id_key"
    ON "asset_assignments"("organization_id", "id");
CREATE UNIQUE INDEX "asset_assignments_org_issuer_key_key"
    ON "asset_assignments"("organization_id", "issued_by_user_id", "idempotency_key");
CREATE UNIQUE INDEX "asset_assignments_one_open_per_asset_key"
    ON "asset_assignments"("organization_id", "asset_id")
    WHERE "returned_at" IS NULL;
CREATE INDEX "asset_assignments_org_asset_issue_idx"
    ON "asset_assignments"("organization_id", "asset_id", "issued_at");
CREATE INDEX "asset_assignments_org_employee_returned_idx"
    ON "asset_assignments"("organization_id", "employee_id", "returned_at");

CREATE UNIQUE INDEX "asset_returns_organization_id_id_key"
    ON "asset_returns"("organization_id", "id");
CREATE UNIQUE INDEX "asset_returns_org_assignment_key"
    ON "asset_returns"("organization_id", "assignment_id");
CREATE UNIQUE INDEX "asset_returns_org_receiver_key_key"
    ON "asset_returns"("organization_id", "received_by_user_id", "idempotency_key");
CREATE INDEX "asset_returns_org_returned_at_idx"
    ON "asset_returns"("organization_id", "returned_at", "id");

ALTER TABLE "asset_assignments"
    ADD CONSTRAINT "asset_assignments_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_assignments"
    ADD CONSTRAINT "asset_assignments_organization_id_asset_id_fkey"
    FOREIGN KEY ("organization_id", "asset_id")
    REFERENCES "assets"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_assignments"
    ADD CONSTRAINT "asset_assignments_organization_id_employee_id_fkey"
    FOREIGN KEY ("organization_id", "employee_id")
    REFERENCES "employees"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_assignments"
    ADD CONSTRAINT "asset_assignments_organization_id_issued_by_user_id_fkey"
    FOREIGN KEY ("organization_id", "issued_by_user_id")
    REFERENCES "users"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_returns"
    ADD CONSTRAINT "asset_returns_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_returns"
    ADD CONSTRAINT "asset_returns_organization_id_assignment_id_fkey"
    FOREIGN KEY ("organization_id", "assignment_id")
    REFERENCES "asset_assignments"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_returns"
    ADD CONSTRAINT "asset_returns_organization_id_received_by_user_id_fkey"
    FOREIGN KEY ("organization_id", "received_by_user_id")
    REFERENCES "users"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
