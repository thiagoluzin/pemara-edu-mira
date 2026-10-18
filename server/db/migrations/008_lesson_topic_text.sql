-- The lesson form accepts detailed guidance (up to 2000 characters).
-- Preserve the complete brief instead of failing or truncating it on save.
ALTER TABLE lessons ALTER COLUMN topic TYPE TEXT;
