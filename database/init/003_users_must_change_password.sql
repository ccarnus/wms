-- 003_users_must_change_password.sql — Add forced password change flag

ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
