-- Add integration columns to users table for Notion, Twitter, Reddit
ALTER TABLE users ADD COLUMN IF NOT EXISTS notion_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS notion_database_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS notion_last_sync TIMESTAMP;
