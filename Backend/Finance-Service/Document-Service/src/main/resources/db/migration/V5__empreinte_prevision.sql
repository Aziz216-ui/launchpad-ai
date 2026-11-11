-- Empreinte SHA-256 (hexadécimal) des chiffres de la prévision utilisés pour générer le document.
-- À la certification, elle doit être identique à celle de la prévision validée : sinon le document ne reflète
-- plus les chiffres validés et doit être regénéré. Null pour les documents antérieurs (à regénérer).
ALTER TABLE document_financier ADD COLUMN empreinte_prevision VARCHAR(64);
