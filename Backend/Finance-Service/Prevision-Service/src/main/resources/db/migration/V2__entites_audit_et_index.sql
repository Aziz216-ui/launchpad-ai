-- Verrouillage optimiste et audit sur la racine d'agrégat (prevision).
ALTER TABLE prevision
    ADD COLUMN version    BIGINT      NOT NULL DEFAULT 0,
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Les valeurs par défaut ne servent qu'au rattrapage des lignes existantes : Hibernate renseigne ces colonnes.
ALTER TABLE prevision ALTER COLUMN version DROP DEFAULT, ALTER COLUMN updated_at DROP DEFAULT;

-- Les listes par projet sont triées du plus récent au plus ancien : index composite couvrant filtre + tri.
DROP INDEX idx_prevision_projet_id;
CREATE INDEX idx_prevision_projet_created ON prevision (projet_id, created_at DESC);
