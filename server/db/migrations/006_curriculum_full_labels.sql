-- A BNCC pode associar vários objetos de conhecimento a uma habilidade.
-- Preserve os rótulos completos sem truncar a informação curricular.
ALTER TABLE curriculum_skills ALTER COLUMN knowledge_object TYPE TEXT;
ALTER TABLE curriculum_skills ALTER COLUMN thematic_unit TYPE TEXT;
