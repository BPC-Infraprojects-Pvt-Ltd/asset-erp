CREATE TYPE "AssetCriticality" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

ALTER TABLE "assets"
    ADD COLUMN "criticality" "AssetCriticality";
