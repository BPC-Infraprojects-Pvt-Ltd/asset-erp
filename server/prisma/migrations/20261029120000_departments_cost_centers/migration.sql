CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "departments_version_positive_check" CHECK ("version" > 0)
);

CREATE TABLE "cost_centers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cost_centers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cost_centers_version_positive_check" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "departments_organization_id_id_key"
    ON "departments"("organization_id", "id");
CREATE UNIQUE INDEX "departments_organization_id_code_key"
    ON "departments"("organization_id", "code");
CREATE INDEX "departments_org_active_code_idx"
    ON "departments"("organization_id", "is_active", "code");

CREATE UNIQUE INDEX "cost_centers_organization_id_id_key"
    ON "cost_centers"("organization_id", "id");
CREATE UNIQUE INDEX "cost_centers_organization_id_code_key"
    ON "cost_centers"("organization_id", "code");
CREATE INDEX "cost_centers_org_active_code_idx"
    ON "cost_centers"("organization_id", "is_active", "code");

ALTER TABLE "departments"
    ADD CONSTRAINT "departments_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cost_centers"
    ADD CONSTRAINT "cost_centers_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
