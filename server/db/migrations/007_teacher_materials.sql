CREATE TABLE IF NOT EXISTS teacher_materials (
  id VARCHAR(64) PRIMARY KEY,
  owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  filename VARCHAR(512) NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  byte_length INTEGER NOT NULL,
  original_base64 TEXT NOT NULL,
  extraction_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_teacher_materials_owner ON teacher_materials(owner_id);
