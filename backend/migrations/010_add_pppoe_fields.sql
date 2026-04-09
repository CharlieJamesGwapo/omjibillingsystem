-- backend/migrations/010_add_pppoe_fields.sql
ALTER TABLE plans ADD COLUMN IF NOT EXISTS mikrotik_profile TEXT;

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS pppoe_username TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS pppoe_password TEXT;
