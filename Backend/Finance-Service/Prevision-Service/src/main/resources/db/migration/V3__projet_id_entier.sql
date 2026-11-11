-- projet_id devient un entier (BIGINT), comme dans les autres services de la plateforme
-- (Market, AI, User...). Un UUID ne peut pas etre converti en entier : les donnees de
-- developpement existantes sont donc supprimees (projection est supprimee en cascade).
TRUNCATE TABLE prevision CASCADE;
ALTER TABLE prevision DROP COLUMN projet_id;
ALTER TABLE prevision ADD COLUMN projet_id BIGINT NOT NULL;
CREATE INDEX idx_prevision_projet_created ON prevision (projet_id, created_at DESC);
