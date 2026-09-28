-- ====================================================================
-- PEMARA EDU — RELATIONAL CANONICAL SCHEMA DDL (v1.0)
-- Banco de dados relacional canônico para usuários, aulas autorais,
-- revisões, rascunhos, histórico de atividades, ontologia curricular,
-- fontes formais, licenças, recursos, staging e content packs versionados.
-- ====================================================================

-- 1. Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela de Controle de Migrações
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    checksum VARCHAR(64) NOT NULL
);

-- 3. Tabela de Fontes Formais e Acadêmicas
CREATE TABLE IF NOT EXISTS sources (
    id VARCHAR(64) PRIMARY KEY,
    provider VARCHAR(128) NOT NULL,
    title VARCHAR(255) NOT NULL,
    url TEXT,
    author VARCHAR(255),
    language VARCHAR(10) DEFAULT 'pt-BR',
    source_type VARCHAR(32) NOT NULL CHECK (source_type IN ('official', 'open_data', 'open_content', 'encyclopedia', 'institutional', 'internal')),
    retrieved_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(32) DEFAULT 'verified' CHECK (status IN ('verified', 'curated', 'under_review'))
);

-- 4. Tabela de Licenças Legais
CREATE TABLE IF NOT EXISTS licenses (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64) NOT NULL,
    url TEXT,
    commercial_use BOOLEAN DEFAULT FALSE,
    derivatives_allowed BOOLEAN DEFAULT TRUE,
    attribution_required BOOLEAN DEFAULT TRUE,
    redistribution_allowed BOOLEAN DEFAULT TRUE,
    verified BOOLEAN DEFAULT TRUE,
    notes TEXT
);

-- 5. Tabela de Habilidades Curriculares (BNCC)
CREATE TABLE IF NOT EXISTS curriculum_skills (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL, -- Ex: 'EF06HI09'
    thematic_unit VARCHAR(255) NOT NULL,
    knowledge_object VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    grade_level SMALLINT NOT NULL CHECK (grade_level BETWEEN 6 AND 9),
    subject_code VARCHAR(32) NOT NULL CHECK (subject_code IN ('history', 'geography', 'science', 'math')),
    source_id VARCHAR(64) REFERENCES sources(id) ON DELETE RESTRICT,
    status VARCHAR(32) DEFAULT 'OFFICIAL_BNCC',
    version VARCHAR(32) DEFAULT '2018.3'
);

-- 6. Tabela de Usuários e Professores
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher', 'editor', 'curator', 'admin')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 7. Tabela de Sessões Locais
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- 8. Tabela de Aulas (com Proprietário e Soft Delete)
-- ON DELETE RESTRICT protege o acervo autoral contra exclusão acidental de contas
CREATE TABLE IF NOT EXISTS lessons (
    id VARCHAR(64) PRIMARY KEY,
    owner_id VARCHAR(64) REFERENCES users(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    subject_code VARCHAR(32) NOT NULL,
    grade_level VARCHAR(16) NOT NULL,
    topic VARCHAR(128) NOT NULL,
    template_id VARCHAR(64),
    current_version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(32) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SAVED', 'PUBLISHED', 'ARCHIVED')),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lessons_owner ON lessons(owner_id);
CREATE INDEX IF NOT EXISTS idx_lessons_subject_grade ON lessons(subject_code, grade_level);
CREATE INDEX IF NOT EXISTS idx_lessons_deleted ON lessons(is_deleted);

-- 9. Tabela de Revisões Imutáveis de Aulas (Snapshots Versionados)
CREATE TABLE IF NOT EXISTS lesson_revisions (
    id VARCHAR(64) PRIMARY KEY,
    lesson_id VARCHAR(64) NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    spec_json JSONB NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    renderer_version VARCHAR(32) DEFAULT '1.0.0',
    created_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    change_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_lesson_version UNIQUE (lesson_id, version)
);

CREATE INDEX IF NOT EXISTS idx_lesson_revisions_lookup ON lesson_revisions(lesson_id, version);

-- 10. Tabela de Rascunhos Persistentes de Aulas (Autosave)
CREATE TABLE IF NOT EXISTS lesson_drafts (
    lesson_id VARCHAR(64) PRIMARY KEY REFERENCES lessons(id) ON DELETE CASCADE,
    owner_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    draft_spec_json JSONB NOT NULL,
    base_version INTEGER NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. Tabela de Tentativas de Geração
CREATE TABLE IF NOT EXISTS generation_attempts (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    lesson_id VARCHAR(64) REFERENCES lessons(id) ON DELETE SET NULL,
    requested_mode VARCHAR(32) NOT NULL,
    executed_mode VARCHAR(32) NOT NULL,
    fallback_reason TEXT,
    parameters_json JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'REJECTED')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 12. Tabela de Histórico de Atividades e Auditoria
CREATE TABLE IF NOT EXISTS activity_history (
    id VARCHAR(64) PRIMARY KEY,
    entity_type VARCHAR(32) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    actor_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    version INTEGER,
    details_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_history_entity ON activity_history(entity_type, entity_id);

-- 13. Tabela Canônica de Nós de Conhecimento (Knowledge Graph Nodes)
CREATE TABLE IF NOT EXISTS knowledge_nodes (
    id VARCHAR(64) PRIMARY KEY,
    slug VARCHAR(128) UNIQUE NOT NULL,
    type VARCHAR(32) NOT NULL CHECK (type IN ('concept', 'event', 'person', 'place', 'period', 'formula', 'process', 'definition', 'theory', 'object')),
    title VARCHAR(255) NOT NULL,
    short_description TEXT NOT NULL,
    subject_code VARCHAR(32) NOT NULL CHECK (subject_code IN ('history', 'geography', 'science', 'math')),
    grade_level SMALLINT NOT NULL CHECK (grade_level BETWEEN 6 AND 9),
    data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    language VARCHAR(10) DEFAULT 'pt-BR',
    source_id VARCHAR(64) REFERENCES sources(id) ON DELETE RESTRICT,
    license_id VARCHAR(64) REFERENCES licenses(id) ON DELETE RESTRICT,
    status VARCHAR(32) DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'DEPRECATED', 'REJECTED')),
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_slug ON knowledge_nodes(slug);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_subject_grade ON knowledge_nodes(subject_code, grade_level);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_type ON knowledge_nodes(type);

-- 14. Tabela de Relações Ontológicas (Knowledge Graph Edges)
CREATE TABLE IF NOT EXISTS knowledge_relations (
    id VARCHAR(64) PRIMARY KEY,
    from_node_id VARCHAR(64) NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
    relation_type VARCHAR(32) NOT NULL CHECK (relation_type IN ('part_of', 'contains', 'located_in', 'preceded_by', 'followed_by', 'caused_by', 'influenced', 'related_to', 'example_of', 'requires', 'contrasts_with', 'created_by', 'occurred_in')),
    to_node_id VARCHAR(64) NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
    source_id VARCHAR(64) REFERENCES sources(id) ON DELETE SET NULL,
    status VARCHAR(32) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVIEW')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_relation UNIQUE (from_node_id, relation_type, to_node_id)
);

CREATE INDEX IF NOT EXISTS idx_relations_from ON knowledge_relations(from_node_id);
CREATE INDEX IF NOT EXISTS idx_relations_to ON knowledge_relations(to_node_id);

-- 15. Tabela de Ligação Habilidade Curricular <-> Nó de Conhecimento
CREATE TABLE IF NOT EXISTS curriculum_knowledge_links (
    id VARCHAR(64) PRIMARY KEY,
    curriculum_skill_id VARCHAR(64) NOT NULL REFERENCES curriculum_skills(id) ON DELETE CASCADE,
    knowledge_node_id VARCHAR(64) NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
    priority SMALLINT DEFAULT 1,
    required BOOLEAN DEFAULT TRUE,
    CONSTRAINT unique_curr_knowledge_link UNIQUE (curriculum_skill_id, knowledge_node_id)
);

-- 16. Tabela de Recursos Visuais e Didáticos
CREATE TABLE IF NOT EXISTS resources (
    id VARCHAR(64) PRIMARY KEY,
    type VARCHAR(32) NOT NULL CHECK (type IN ('image', 'map', 'diagram', 'chart', 'timeline', 'comparison_table', 'simulation', 'quiz_asset')),
    title VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type VARCHAR(64) NOT NULL,
    width INTEGER,
    height INTEGER,
    source_id VARCHAR(64) REFERENCES sources(id) ON DELETE RESTRICT,
    license_id VARCHAR(64) REFERENCES licenses(id) ON DELETE RESTRICT,
    status VARCHAR(32) DEFAULT 'ACTIVE',
    metadata_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS resource_links (
    id VARCHAR(64) PRIMARY KEY,
    resource_id VARCHAR(64) NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    knowledge_node_id VARCHAR(64) NOT NULL REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL CHECK (role IN ('main_image', 'map', 'comparison', 'illustration', 'simulation', 'quiz_asset'))
);

-- 17. Tabela de Lotes de Importação Externa (Wikidata / BNCC)
CREATE TABLE IF NOT EXISTS import_batches (
    id VARCHAR(64) PRIMARY KEY,
    provider VARCHAR(64) NOT NULL,
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMPTZ,
    records_found INTEGER DEFAULT 0,
    records_imported INTEGER DEFAULT 0,
    records_rejected INTEGER DEFAULT 0,
    records_duplicates INTEGER DEFAULT 0,
    status VARCHAR(32) DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')),
    log_path TEXT
);

-- 18. Tabela de Staging para Curadoria Editorial e Anti-Duplicatas
CREATE TABLE IF NOT EXISTS staging_nodes (
    id VARCHAR(64) PRIMARY KEY,
    import_batch_id VARCHAR(64) REFERENCES import_batches(id) ON DELETE CASCADE,
    source_provider VARCHAR(64) NOT NULL,
    external_id VARCHAR(128),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(128) NOT NULL,
    type VARCHAR(32) NOT NULL,
    short_description TEXT NOT NULL,
    data_json JSONB DEFAULT '{}'::jsonb,
    validation_status VARCHAR(32) DEFAULT 'NEW' CHECK (validation_status IN ('NEW', 'DUPLICATE', 'CONFLICT', 'VALID', 'APPROVED', 'DISCARDED')),
    duplicate_candidate_id VARCHAR(64) REFERENCES knowledge_nodes(id) ON DELETE SET NULL,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_staging_provider_ext UNIQUE (source_provider, external_id)
);

-- 19. Tabela de Auditoria e Versionamento Imutável de Entidades
CREATE TABLE IF NOT EXISTS entity_versions (
    id VARCHAR(64) PRIMARY KEY,
    entity_type VARCHAR(32) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    version INTEGER NOT NULL,
    snapshot_json JSONB NOT NULL,
    changed_by VARCHAR(128) NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    change_reason TEXT NOT NULL,
    CONSTRAINT unique_entity_version UNIQUE (entity_type, entity_id, version)
);

CREATE INDEX IF NOT EXISTS idx_entity_versions_lookup ON entity_versions(entity_type, entity_id, version);

-- 20. Tabela de Content Packs Canônicos
CREATE TABLE IF NOT EXISTS content_packs (
    id VARCHAR(64) PRIMARY KEY,
    slug VARCHAR(128) UNIQUE NOT NULL,
    subject_code VARCHAR(32) NOT NULL,
    grade_level SMALLINT NOT NULL,
    topic_node_id VARCHAR(64) REFERENCES knowledge_nodes(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(32) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 21. Tabela de Content Pack Versions Imutáveis
CREATE TABLE IF NOT EXISTS content_pack_versions (
    id VARCHAR(64) PRIMARY KEY,
    pack_id VARCHAR(64) NOT NULL REFERENCES content_packs(id) ON DELETE CASCADE,
    version VARCHAR(32) NOT NULL,
    schema_version VARCHAR(32) NOT NULL DEFAULT '1.0',
    content_hash VARCHAR(64) NOT NULL,
    manifest_json JSONB NOT NULL,
    payload_json JSONB NOT NULL,
    status VARCHAR(32) DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED')),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_pack_version UNIQUE (pack_id, version)
);

CREATE INDEX IF NOT EXISTS idx_pack_versions_lookup ON content_pack_versions(pack_id, version);

-- 22. Tabela de Vínculos Versão de Pack <-> Versões de Entidades
CREATE TABLE IF NOT EXISTS content_pack_entity_links (
    id VARCHAR(64) PRIMARY KEY,
    pack_version_id VARCHAR(64) NOT NULL REFERENCES content_pack_versions(id) ON DELETE CASCADE,
    entity_type VARCHAR(32) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    entity_version INTEGER NOT NULL,
    CONSTRAINT unique_pack_entity_link UNIQUE (pack_version_id, entity_type, entity_id, entity_version)
);
