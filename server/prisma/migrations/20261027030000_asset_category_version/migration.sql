ALTER TABLE "asset_categories"
    ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "asset_categories"
    ADD CONSTRAINT "asset_categories_version_positive_check"
    CHECK ("version" > 0);
