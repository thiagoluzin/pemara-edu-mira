-- ====================================================================
-- PEMARA EDU — MIGRAÇÃO 002: AUDITORIA, RATE LIMIT E SESSÕES ESTENDIDAS
-- ====================================================================

-- 1. Extensão de Sessões para auditoria de atividade e revogação explícita
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sessions_revoked ON sessions(revoked_at);
CREATE INDEX IF NOT EXISTS idx_sessions_last_activity ON sessions(last_activity_at);

-- 2. Tabela de Eventos de Autenticação e Segurança (Auth Audit Logs)
CREATE TABLE IF NOT EXISTS auth_events (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    username_attempted VARCHAR(64) NOT NULL,
    event_type VARCHAR(64) NOT NULL CHECK (event_type IN (
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
        'ARCHIVE_EXPORTED'
    )),
    ip_address VARCHAR(45),
    user_agent TEXT,
    details_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_auth_events_created ON auth_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_user ON auth_events(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_events_type ON auth_events(event_type);

-- 3. Tabela de Rate Limiting para Prevenção de Ataques de Força Bruta
CREATE TABLE IF NOT EXISTS login_rate_limits (
    identifier VARCHAR(128) PRIMARY KEY,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_attempt_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_locked ON login_rate_limits(locked_until);
