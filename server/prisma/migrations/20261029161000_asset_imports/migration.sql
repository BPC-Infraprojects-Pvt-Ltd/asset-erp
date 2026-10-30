CREATE TYPE "AssetImportStatus" AS ENUM (
    'UPLOADED',
    'VALIDATING',
    'PREVIEW_READY',
    'FAILED',
    'COMMITTING',
    'COMMITTED'
);

CREATE TABLE "asset_import_jobs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "status" "AssetImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "file_checksum" CHAR(64) NOT NULL,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "created_count" INTEGER NOT NULL DEFAULT 0,
    "preview_idempotency_key" VARCHAR(100) NOT NULL,
    "preview_payload_hash" CHAR(64) NOT NULL,
    "commit_idempotency_key" VARCHAR(100),
    "commit_payload_hash" CHAR(64),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "committed_at" TIMESTAMPTZ(3),

    CONSTRAINT "asset_import_jobs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "asset_import_jobs_counts_nonnegative_check"
        CHECK ("total_rows" >= 0 AND "valid_rows" >= 0 AND "error_count" >= 0 AND "created_count" >= 0),
    CONSTRAINT "asset_import_jobs_version_positive_check" CHECK ("version" > 0),
    CONSTRAINT "asset_import_jobs_commit_identity_check"
        CHECK (("commit_idempotency_key" IS NULL) = ("commit_payload_hash" IS NULL))
);

CREATE TABLE "asset_import_row_errors" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "import_job_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "field_name" VARCHAR(80) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_import_row_errors_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "asset_import_row_errors_row_number_positive_check" CHECK ("row_number" > 0)
);

CREATE UNIQUE INDEX "asset_import_jobs_organization_id_id_key"
    ON "asset_import_jobs"("organization_id", "id");
CREATE UNIQUE INDEX "asset_import_jobs_org_creator_preview_key"
    ON "asset_import_jobs"("organization_id", "created_by_user_id", "preview_idempotency_key");
CREATE UNIQUE INDEX "asset_import_jobs_org_creator_commit_key"
    ON "asset_import_jobs"("organization_id", "created_by_user_id", "commit_idempotency_key");
CREATE INDEX "asset_import_jobs_org_creator_time_idx"
    ON "asset_import_jobs"("organization_id", "created_by_user_id", "created_at", "id");
CREATE INDEX "asset_import_jobs_org_status_time_idx"
    ON "asset_import_jobs"("organization_id", "status", "created_at");

CREATE UNIQUE INDEX "asset_import_row_errors_organization_id_id_key"
    ON "asset_import_row_errors"("organization_id", "id");
CREATE UNIQUE INDEX "asset_import_row_errors_job_row_field_code_key"
    ON "asset_import_row_errors"("organization_id", "import_job_id", "row_number", "field_name", "code");
CREATE INDEX "asset_import_row_errors_org_job_row_idx"
    ON "asset_import_row_errors"("organization_id", "import_job_id", "row_number");

ALTER TABLE "asset_import_jobs"
    ADD CONSTRAINT "asset_import_jobs_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_import_jobs"
    ADD CONSTRAINT "asset_import_jobs_organization_id_created_by_user_id_fkey"
    FOREIGN KEY ("organization_id", "created_by_user_id")
    REFERENCES "users"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_import_row_errors"
    ADD CONSTRAINT "asset_import_row_errors_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_import_row_errors"
    ADD CONSTRAINT "asset_import_row_errors_organization_id_import_job_id_fkey"
    FOREIGN KEY ("organization_id", "import_job_id")
    REFERENCES "asset_import_jobs"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
