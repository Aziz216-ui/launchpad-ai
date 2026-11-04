-- Verrouillage optimiste et audit sur la racine d'agrégat (document_financier).
ALTER TABLE document_financier
    ADD COLUMN version    BIGINT      NOT NULL DEFAULT 0,
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Les valeurs par défaut ne servent qu'au rattrapage des lignes existantes : Hibernate renseigne ces colonnes.
ALTER TABLE document_financier ALTER COLUMN version DROP DEFAULT, ALTER COLUMN updated_at DROP DEFAULT;

-- Les listes par projet sont triées du plus récent au plus ancien : index composite couvrant filtre + tri.
DROP INDEX idx_document_financier_projet_id;
CREATE INDEX idx_document_financier_projet_created ON document_financier (projet_id, created_at DESC);
