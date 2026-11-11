-- Prévision source d'un document (null pour les documents antérieurs) et certification par un financier invité
-- sur le projet (null tant que non certifié). Un document ne se certifie que si sa prévision source est validée.
ALTER TABLE document_financier
    ADD COLUMN prevision_id              UUID,
    ADD COLUMN certifie_par              VARCHAR(320),
    ADD COLUMN certifie_le               TIMESTAMPTZ,
    ADD COLUMN commentaire_certification VARCHAR(2000),
    ADD CONSTRAINT ck_document_certification CHECK ((certifie_par IS NULL) = (certifie_le IS NULL));
