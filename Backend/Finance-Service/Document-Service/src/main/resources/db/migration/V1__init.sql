-- Schéma de document_db (document-service).
-- Aucune clé étrangère vers d'autres bases : le projet est référencé par projet_id uniquement.

CREATE TABLE document_financier (
    id         UUID        PRIMARY KEY,
    projet_id  UUID        NOT NULL,
    type       VARCHAR(30) NOT NULL,
    contenu    JSONB       NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_document_financier_projet_id ON document_financier (projet_id);
