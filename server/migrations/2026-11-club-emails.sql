-- Club contact emails, shown on the Clubs page and each club's page.
-- Run once in the Supabase SQL editor BEFORE deploying (safe to run again).
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_email varchar(255);
