-- Rôles sur un projet (propriétaire / financier invité) et avis du financier sur les prévisions.

-- Avis du financier : EN_ATTENTE par défaut, y compris pour les prévisions existantes.
ALTER TABLE prevision
    ADD COLUMN statut_validation      VARCHAR(20)   NOT NULL DEFAULT 'EN_ATTENTE',
    ADD COLUMN commentaire_validation VARCHAR(2000),
    ADD COLUMN valide_par             VARCHAR(320),
    ADD COLUMN valide_le              TIMESTAMPTZ,
    ADD CONSTRAINT ck_prevision_statut_validation
        CHECK (statut_validation IN ('EN_ATTENTE', 'VALIDEE', 'REJETEE'));

-- Membres d'un projet. Le propriétaire est reconnu par son identifiant Keycloak (sub),
-- un financier par son e-mail (il est invité avant de s'être connecté).
CREATE TABLE membre_projet (
    id             UUID         PRIMARY KEY,
    projet_id      BIGINT       NOT NULL,
    role           VARCHAR(20)  NOT NULL,
    utilisateur_id VARCHAR(255),
    email          VARCHAR(320),
    version        BIGINT       NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL,
    updated_at     TIMESTAMPTZ  NOT NULL,
    CONSTRAINT ck_membre_projet_role CHECK (role IN ('PROPRIETAIRE', 'FINANCIER')),
    CONSTRAINT ck_membre_projet_identite CHECK (
        (role = 'PROPRIETAIRE' AND utilisateur_id IS NOT NULL) OR (role = 'FINANCIER' AND email IS NOT NULL)
    )
);

-- Un seul propriétaire par projet ; un financier n'est invité qu'une fois par projet.
CREATE UNIQUE INDEX uk_membre_projet_proprietaire ON membre_projet (projet_id) WHERE role = 'PROPRIETAIRE';
CREATE UNIQUE INDEX uk_membre_projet_financier ON membre_projet (projet_id, email) WHERE role = 'FINANCIER';
-- « Mes projets » : recherche par propriétaire ou par e-mail du financier.
CREATE INDEX idx_membre_projet_utilisateur ON membre_projet (utilisateur_id);
CREATE INDEX idx_membre_projet_email ON membre_projet (email);
