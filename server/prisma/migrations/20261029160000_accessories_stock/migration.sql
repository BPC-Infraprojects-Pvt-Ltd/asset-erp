CREATE TYPE "AssetTrackingMode" AS ENUM ('INDIVIDUAL', 'QUANTITY');
CREATE TYPE "StockMovementType" AS ENUM ('RECEIPT', 'ISSUE', 'RETURN', 'TRANSFER');

ALTER TABLE "asset_categories"
    ADD COLUMN "tracking_mode" "AssetTrackingMode" NOT NULL DEFAULT 'INDIVIDUAL';

CREATE TABLE "stock_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(1000),
    "created_by_user_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_items_version_positive_check" CHECK ("version" > 0)
);

CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "stock_item_id" UUID NOT NULL,
    "movement_type" "StockMovementType" NOT NULL,
    "source_store_id" UUID,
    "destination_store_id" UUID,
    "quantity" INTEGER NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "source_reference" VARCHAR(150),
    "created_by_user_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(100) NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_movements_quantity_positive_check" CHECK ("quantity" > 0),
    CONSTRAINT "stock_movements_location_shape_check" CHECK (
        ("movement_type" = 'RECEIPT' AND "source_store_id" IS NULL AND "destination_store_id" IS NOT NULL)
        OR ("movement_type" = 'ISSUE' AND "source_store_id" IS NOT NULL AND "destination_store_id" IS NULL)
        OR ("movement_type" = 'RETURN' AND "source_store_id" IS NULL AND "destination_store_id" IS NOT NULL)
        OR ("movement_type" = 'TRANSFER' AND "source_store_id" IS NOT NULL AND "destination_store_id" IS NOT NULL AND "source_store_id" <> "destination_store_id")
    )
);

CREATE TABLE "stock_reservations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "stock_item_id" UUID NOT NULL,
    "store_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "cancelled_by_user_id" UUID,
    "cancelled_at" TIMESTAMPTZ(3),
    "idempotency_key" VARCHAR(100) NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stock_reservations_quantity_positive_check" CHECK ("quantity" > 0),
    CONSTRAINT "stock_reservations_version_positive_check" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "stock_items_organization_id_id_key"
    ON "stock_items"("organization_id", "id");
CREATE UNIQUE INDEX "stock_items_org_code_key"
    ON "stock_items"("organization_id", "code");
CREATE INDEX "stock_items_org_category_active_idx"
    ON "stock_items"("organization_id", "category_id", "is_active");

CREATE UNIQUE INDEX "stock_movements_organization_id_id_key"
    ON "stock_movements"("organization_id", "id");
CREATE UNIQUE INDEX "stock_movements_org_actor_key_key"
    ON "stock_movements"("organization_id", "created_by_user_id", "idempotency_key");
CREATE INDEX "stock_movements_org_item_time_idx"
    ON "stock_movements"("organization_id", "stock_item_id", "created_at", "id");
CREATE INDEX "stock_movements_org_source_store_item_idx"
    ON "stock_movements"("organization_id", "source_store_id", "stock_item_id");
CREATE INDEX "stock_movements_org_destination_store_item_idx"
    ON "stock_movements"("organization_id", "destination_store_id", "stock_item_id");

CREATE UNIQUE INDEX "stock_reservations_organization_id_id_key"
    ON "stock_reservations"("organization_id", "id");
CREATE UNIQUE INDEX "stock_reservations_org_actor_key_key"
    ON "stock_reservations"("organization_id", "created_by_user_id", "idempotency_key");
CREATE INDEX "stock_reservations_org_item_store_open_idx"
    ON "stock_reservations"("organization_id", "stock_item_id", "store_id", "cancelled_at");

ALTER TABLE "stock_items"
    ADD CONSTRAINT "stock_items_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_items"
    ADD CONSTRAINT "stock_items_organization_id_category_id_fkey"
    FOREIGN KEY ("organization_id", "category_id")
    REFERENCES "asset_categories"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_items"
    ADD CONSTRAINT "stock_items_organization_id_created_by_user_id_fkey"
    FOREIGN KEY ("organization_id", "created_by_user_id")
    REFERENCES "users"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_movements"
    ADD CONSTRAINT "stock_movements_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements"
    ADD CONSTRAINT "stock_movements_organization_id_stock_item_id_fkey"
    FOREIGN KEY ("organization_id", "stock_item_id")
    REFERENCES "stock_items"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements"
    ADD CONSTRAINT "stock_movements_organization_id_source_store_id_fkey"
    FOREIGN KEY ("organization_id", "source_store_id")
    REFERENCES "stores"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements"
    ADD CONSTRAINT "stock_movements_organization_id_destination_store_id_fkey"
    FOREIGN KEY ("organization_id", "destination_store_id")
    REFERENCES "stores"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements"
    ADD CONSTRAINT "stock_movements_organization_id_created_by_user_id_fkey"
    FOREIGN KEY ("organization_id", "created_by_user_id")
    REFERENCES "users"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_reservations"
    ADD CONSTRAINT "stock_reservations_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_reservations"
    ADD CONSTRAINT "stock_reservations_organization_id_stock_item_id_fkey"
    FOREIGN KEY ("organization_id", "stock_item_id")
    REFERENCES "stock_items"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_reservations"
    ADD CONSTRAINT "stock_reservations_organization_id_store_id_fkey"
    FOREIGN KEY ("organization_id", "store_id")
    REFERENCES "stores"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_reservations"
    ADD CONSTRAINT "stock_reservations_organization_id_created_by_user_id_fkey"
    FOREIGN KEY ("organization_id", "created_by_user_id")
    REFERENCES "users"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_reservations"
    ADD CONSTRAINT "stock_reservations_organization_id_cancelled_by_user_id_fkey"
    FOREIGN KEY ("organization_id", "cancelled_by_user_id")
    REFERENCES "users"("organization_id", "id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
