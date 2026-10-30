ALTER TABLE "asset_categories"
    ADD COLUMN "specification_fields" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "assets"
    ADD COLUMN "specifications" JSONB;
