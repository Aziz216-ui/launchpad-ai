-- projet_id devient un entier (BIGINT), comme dans les autres services de la plateforme
-- (Market, AI, User...). Un UUID ne peut pas etre converti en entier : les donnees de
-- developpement existantes sont donc supprimees.
TRUNCATE TABLE document_financier CASCADE;
ALTER TABLE document_financier DROP COLUMN projet_id;
ALTER TABLE document_financier ADD COLUMN projet_id BIGINT NOT NULL;
CREATE INDEX idx_document_financier_projet_created ON document_financier (projet_id, created_at DESC);
