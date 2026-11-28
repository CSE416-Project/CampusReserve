-- Optional email on general accounts (for password resets).
-- The address waits on its confirmation link until the person opens it.
-- Run once in the Supabase SQL editor BEFORE deploying this change (safe to run again).
ALTER TABLE auth_tokens ADD COLUMN IF NOT EXISTS email varchar(255);
