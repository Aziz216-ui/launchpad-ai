-- Schéma de prevision_db (prevision-service).
-- Aucune clé étrangère vers d'autres bases : le projet est référencé par projet_id uniquement.

CREATE TABLE prevision (
    id               UUID           PRIMARY KEY,
    projet_id        UUID           NOT NULL,
    periode          VARCHAR(50)    NOT NULL,
    chiffre_affaires NUMERIC(15, 2) NOT NULL,
    couts_directs    NUMERIC(15, 2) NOT NULL,
    depenses         NUMERIC(15, 2) NOT NULL,
    created_at       TIMESTAMPTZ    NOT NULL,
    CONSTRAINT ck_prevision_montants CHECK (
        chiffre_affaires >= 0 AND couts_directs >= 0 AND depenses >= 0 AND couts_directs <= depenses
    )
);
CREATE INDEX idx_prevision_projet_id ON prevision (projet_id);

CREATE TABLE projection (
    id               UUID           PRIMARY KEY,
    prevision_id     UUID           NOT NULL REFERENCES prevision (id) ON DELETE CASCADE,
    annee            INTEGER        NOT NULL,
    chiffre_affaires NUMERIC(15, 2) NOT NULL,
    depenses         NUMERIC(15, 2) NOT NULL,
    marge            NUMERIC(15, 2) NOT NULL,
    CONSTRAINT uk_projection_prevision_annee UNIQUE (prevision_id, annee),
    CONSTRAINT ck_projection_annee CHECK (annee >= 1)
);
