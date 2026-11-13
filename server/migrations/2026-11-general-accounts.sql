-- General accounts: sign up with a username + password, no email, search-only.
-- Run once in the Supabase SQL editor (safe to run again).

-- 1. The new role.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'general';

-- 2. Email becomes optional (general accounts don't have one).
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- 3. Usernames, unique ignoring case ("Wolfie" = "wolfie").
ALTER TABLE users ADD COLUMN IF NOT EXISTS username varchar(30);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_username_lower ON users (lower(username));

-- 4. Every account still needs one way to log in.
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT ck_users_email_or_username
    CHECK (email IS NOT NULL OR username IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
