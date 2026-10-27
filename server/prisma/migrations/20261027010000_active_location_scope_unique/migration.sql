CREATE UNIQUE INDEX "user_location_scopes_one_active_grant_key"
ON "user_location_scopes"("organization_id", "user_id", "location_id")
WHERE "revoked_at" IS NULL;
