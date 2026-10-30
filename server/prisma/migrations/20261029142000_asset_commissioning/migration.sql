ALTER TYPE "AssetHistoryEventType" ADD VALUE 'COMMISSIONED';

ALTER TABLE "assets"
    ADD COLUMN "commissioning_date" DATE;
