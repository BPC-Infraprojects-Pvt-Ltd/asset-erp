INSERT INTO "asset_history_events" (
    "id",
    "organization_id",
    "asset_id",
    "actor_user_id",
    "event_type",
    "details",
    "occurred_at"
)
SELECT
    asset."id",
    asset."organization_id",
    asset."id",
    asset."created_by_user_id",
    'REGISTERED',
    '{"source":"pre_history_migration"}'::JSONB,
    asset."created_at"
FROM "assets" AS asset
WHERE NOT EXISTS (
    SELECT 1
    FROM "asset_history_events" AS event
    WHERE event."organization_id" = asset."organization_id"
      AND event."asset_id" = asset."id"
      AND event."event_type" = 'REGISTERED'
);
