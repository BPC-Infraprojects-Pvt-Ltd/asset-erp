ALTER TABLE "assets"
    ADD COLUMN "purchase_date" DATE,
    ADD COLUMN "warranty_expires_on" DATE,
    ADD COLUMN "warranty_reference" VARCHAR(150);
