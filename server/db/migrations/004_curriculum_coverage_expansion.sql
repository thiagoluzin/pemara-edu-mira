-- ====================================================================
-- PEMARA EDU — CURRICULUM COVERAGE EXPANSION (v1.1)
-- Expande restrições de verificação (CHECK) para permitir todos os 9
-- componentes da BNCC do Ensino Fundamental II (6º ao 9º ano) e faixas
-- multianuais oficiais (EF67, EF69, EF89), preservando pilotos de EM.
-- ====================================================================

-- 1. Atualizar restrições de habilidades curriculares (BNCC)
ALTER TABLE curriculum_skills
    DROP CONSTRAINT IF EXISTS curriculum_skills_subject_code_check;

ALTER TABLE curriculum_skills
    ADD CONSTRAINT curriculum_skills_subject_code_check
    CHECK (subject_code IN (
        'portuguese',
        'english',
        'arts',
        'physical_education',
        'math',
        'science',
        'history',
        'geography',
        'religious_education',
        'physics',
        'biology',
        'chemistry'
    ));

ALTER TABLE curriculum_skills
    DROP CONSTRAINT IF EXISTS curriculum_skills_grade_level_check;

ALTER TABLE curriculum_skills
    ADD CONSTRAINT curriculum_skills_grade_level_check
    CHECK (
        (grade_level BETWEEN 1 AND 13)
        OR grade_level IN (67, 69, 89)
    );

-- 2. Atualizar restrições de nós de conhecimento
ALTER TABLE knowledge_nodes
    DROP CONSTRAINT IF EXISTS knowledge_nodes_subject_code_check;

ALTER TABLE knowledge_nodes
    ADD CONSTRAINT knowledge_nodes_subject_code_check
    CHECK (subject_code IN (
        'portuguese',
        'english',
        'arts',
        'physical_education',
        'math',
        'science',
        'history',
        'geography',
        'religious_education',
        'physics',
        'biology',
        'chemistry'
    ));

ALTER TABLE knowledge_nodes
    DROP CONSTRAINT IF EXISTS knowledge_nodes_grade_level_check;

ALTER TABLE knowledge_nodes
    ADD CONSTRAINT knowledge_nodes_grade_level_check
    CHECK (
        (grade_level BETWEEN 1 AND 13)
        OR grade_level IN (67, 69, 89)
    );
