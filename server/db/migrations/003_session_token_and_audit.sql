-- ====================================================================
-- PEMARA EDU — MIGRAÇÃO 003: SEPARAÇÃO DE TOKEN SECRETO E EXPANSÃO DE AUDITORIA
-- ====================================================================

-- 1. Coluna de hash de token de sessão (SHA-256)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS token_hash VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);

-- 2. Revogação explícita de sessões antigas que não possuam hash de token (segurança R4)
UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash IS NULL AND revoked_at IS NULL;

-- 3. Expansão dos tipos de eventos de auditoria e segurança
ALTER TABLE auth_events DROP CONSTRAINT IF EXISTS auth_events_event_type_check;
ALTER TABLE auth_events ADD CONSTRAINT auth_events_event_type_check CHECK (event_type IN (
    'LOGIN_SUCCESS',
    'LOGIN_FAILED',
    'LOGOUT',
    'SESSION_REVOKED',
    'ALL_SESSIONS_REVOKED',
    'PASSWORD_CHANGE',
    'PASSWORD_RESET',
    'ROLE_CHANGE',
    'ACCOUNT_CREATED',
    'ACCOUNT_ACTIVATED',
    'ACCOUNT_DEACTIVATED',
    'LESSON_TRANSFERRED',
    'LESSON_RESTORED',
    'ARCHIVE_EXPORTED',
    'ADMIN_READ_AUDIT',
    'BACKUP_CREATED',
    'BACKUP_RESTORED'
));
