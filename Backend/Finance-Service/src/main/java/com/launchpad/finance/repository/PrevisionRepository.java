package com.launchpad.finance.repository;

import com.launchpad.finance.domain.PrevisionFinanciere;
import com.launchpad.finance.domain.ProjectionFinanciere;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Port de persistance des prévisions (patron Adapter : implémenté par PrevisionRepositoryJpa).
 * Les prévisions renvoyées incluent leurs projections, triées par année.
 */
public interface PrevisionRepository {

    PrevisionFinanciere save(PrevisionFinanciere prevision);

    Optional<PrevisionFinanciere> findById(UUID previsionId);

    /** Prévisions d'un projet, de la plus récente à la plus ancienne. */
    List<PrevisionFinanciere> findByProjetId(UUID projetId);

    Optional<PrevisionFinanciere> findLatestByProjetId(UUID projetId);

    /** Remplace toutes les projections de la prévision par celles fournies. */
    void replaceProjections(UUID previsionId, List<ProjectionFinanciere> projections);
}
