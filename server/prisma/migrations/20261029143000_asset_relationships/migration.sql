ALTER TYPE "AssetHistoryEventType" ADD VALUE 'RELATIONSHIP_ADDED';
ALTER TYPE "AssetHistoryEventType" ADD VALUE 'RELATIONSHIP_REMOVED';

CREATE TABLE "asset_relationships" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "parent_asset_id" UUID NOT NULL,
    "child_asset_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "ended_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),

    CONSTRAINT "asset_relationships_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "asset_relationships_distinct_assets_check"
        CHECK ("parent_asset_id" <> "child_asset_id")
);

CREATE UNIQUE INDEX "asset_relationships_organization_id_id_key"
    ON "asset_relationships"("organization_id", "id");
CREATE UNIQUE INDEX "asset_relationships_active_pair_key"
    ON "asset_relationships"("organization_id", "parent_asset_id", "child_asset_id")
    WHERE "ended_at" IS NULL;
CREATE INDEX "asset_relationships_org_parent_active_idx"
    ON "asset_relationships"("organization_id", "parent_asset_id", "ended_at", "created_at");
CREATE INDEX "asset_relationships_org_child_active_idx"
    ON "asset_relationships"("organization_id", "child_asset_id", "ended_at", "created_at");

ALTER TABLE "asset_relationships"
    ADD CONSTRAINT "asset_relationships_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_relationships"
    ADD CONSTRAINT "asset_relationships_organization_id_parent_asset_id_fkey"
    FOREIGN KEY ("organization_id", "parent_asset_id")
    REFERENCES "assets"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_relationships"
    ADD CONSTRAINT "asset_relationships_organization_id_child_asset_id_fkey"
    FOREIGN KEY ("organization_id", "child_asset_id")
    REFERENCES "assets"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_relationships"
    ADD CONSTRAINT "asset_relationships_organization_id_created_by_user_id_fkey"
    FOREIGN KEY ("organization_id", "created_by_user_id")
    REFERENCES "users"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_relationships"
    ADD CONSTRAINT "asset_relationships_organization_id_ended_by_user_id_fkey"
    FOREIGN KEY ("organization_id", "ended_by_user_id")
    REFERENCES "users"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
