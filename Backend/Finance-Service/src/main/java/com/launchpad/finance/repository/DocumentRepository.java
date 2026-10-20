package com.launchpad.finance.repository;

import com.launchpad.finance.domain.DocumentFinancier;

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
    List<DocumentFinancier> findByProjetId(UUID projetId);

    void deleteById(UUID documentId);
}
