-- ====================================================================
-- PEMARA EDU — CURRICULUM VERBATIM PROVENANCE (v1.2)
-- Adiciona colunas de auditoria e proveniência textual oficial da BNCC
-- (localizador de planilha MEC e página do PDF oficial homologado).
-- ====================================================================

ALTER TABLE curriculum_skills
    ADD COLUMN IF NOT EXISTS locator VARCHAR(255);

ALTER TABLE curriculum_skills
    ADD COLUMN IF NOT EXISTS locator_pdf VARCHAR(255);

ALTER TABLE curriculum_skills
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_curriculum_skills_code ON curriculum_skills(code);
