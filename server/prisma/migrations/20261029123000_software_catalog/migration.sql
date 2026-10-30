CREATE TYPE "SoftwareCommercialClassification" AS ENUM (
    'COMMERCIAL',
    'OPEN_SOURCE',
    'FREEWARE',
    'CUSTOM',
    'OTHER'
);

CREATE TYPE "SoftwarePolicyStatus" AS ENUM (
    'REVIEW_REQUIRED',
    'APPROVED',
    'PROHIBITED'
);

CREATE TABLE "software_products" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "publisher" VARCHAR(150) NOT NULL,
    "publisher_key" VARCHAR(150) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "name_key" VARCHAR(150) NOT NULL,
    "commercial_classification" "SoftwareCommercialClassification" NOT NULL,
    "policy_status" "SoftwarePolicyStatus" NOT NULL DEFAULT 'REVIEW_REQUIRED',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "software_products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "software_products_version_positive_check" CHECK ("version" > 0)
);

CREATE TABLE "software_editions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "name_key" VARCHAR(150) NOT NULL,
    "version_label" VARCHAR(100),
    "version_key" VARCHAR(100) NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "software_editions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "software_editions_version_positive_check" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "software_products_organization_id_id_key"
    ON "software_products"("organization_id", "id");
CREATE UNIQUE INDEX "software_products_org_publisher_name_key"
    ON "software_products"("organization_id", "publisher_key", "name_key");
CREATE INDEX "software_products_org_active_name_idx"
    ON "software_products"("organization_id", "is_active", "name_key");

CREATE UNIQUE INDEX "software_editions_organization_id_id_key"
    ON "software_editions"("organization_id", "id");
CREATE UNIQUE INDEX "software_editions_org_product_name_version_key"
    ON "software_editions"("organization_id", "product_id", "name_key", "version_key");
CREATE INDEX "software_editions_org_product_active_name_idx"
    ON "software_editions"("organization_id", "product_id", "is_active", "name_key");

ALTER TABLE "software_products"
    ADD CONSTRAINT "software_products_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "software_editions"
    ADD CONSTRAINT "software_editions_organization_id_product_id_fkey"
    FOREIGN KEY ("organization_id", "product_id")
    REFERENCES "software_products"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
