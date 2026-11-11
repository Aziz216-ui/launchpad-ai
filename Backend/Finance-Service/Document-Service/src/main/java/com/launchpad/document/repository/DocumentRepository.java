package com.launchpad.document.repository;

import com.launchpad.document.domain.Certification;
import com.launchpad.document.domain.DocumentFinancier;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Port de persistance des documents financiers (patron Adapter).
 */
public interface DocumentRepository {

    DocumentFinancier save(DocumentFinancier document);

    Optional<DocumentFinancier> findById(UUID documentId);

    /** Documents d'un projet, du plus récent au plus ancien. */
    List<DocumentFinancier> findByProjetId(Long projetId);

    void deleteById(UUID documentId);

    /** Enregistre la certification d'un document existant. */
    void updateCertification(UUID documentId, Certification certification);
}
