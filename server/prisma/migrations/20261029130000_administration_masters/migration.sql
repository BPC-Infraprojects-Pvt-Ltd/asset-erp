CREATE TABLE "manufacturers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "name_key" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "manufacturers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "manufacturers_version_positive_check" CHECK ("version" > 0)
);

CREATE TABLE "asset_models" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "manufacturer_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "name_key" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "asset_models_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "asset_models_version_positive_check" CHECK ("version" > 0)
);

CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "employee_number" VARCHAR(150) NOT NULL,
    "display_name" VARCHAR(160) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "employees_version_positive_check" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "manufacturers_organization_id_id_key"
    ON "manufacturers"("organization_id", "id");
CREATE UNIQUE INDEX "manufacturers_org_name_key"
    ON "manufacturers"("organization_id", "name_key");
CREATE INDEX "manufacturers_org_active_name_idx"
    ON "manufacturers"("organization_id", "is_active", "name_key");

CREATE UNIQUE INDEX "asset_models_organization_id_id_key"
    ON "asset_models"("organization_id", "id");
CREATE UNIQUE INDEX "asset_models_org_manufacturer_name_key"
    ON "asset_models"("organization_id", "manufacturer_id", "name_key");
CREATE INDEX "asset_models_org_manufacturer_active_idx"
    ON "asset_models"("organization_id", "manufacturer_id", "is_active", "name_key");

CREATE UNIQUE INDEX "employees_organization_id_id_key"
    ON "employees"("organization_id", "id");
CREATE UNIQUE INDEX "employees_organization_id_employee_number_key"
    ON "employees"("organization_id", "employee_number");
CREATE INDEX "employees_org_active_name_idx"
    ON "employees"("organization_id", "is_active", "display_name");

ALTER TABLE "manufacturers"
    ADD CONSTRAINT "manufacturers_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_models"
    ADD CONSTRAINT "asset_models_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_models"
    ADD CONSTRAINT "asset_models_organization_id_manufacturer_id_fkey"
    FOREIGN KEY ("organization_id", "manufacturer_id")
    REFERENCES "manufacturers"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employees"
    ADD CONSTRAINT "employees_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
