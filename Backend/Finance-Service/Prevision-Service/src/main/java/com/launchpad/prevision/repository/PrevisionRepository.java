package com.launchpad.prevision.repository;

import com.launchpad.prevision.domain.PrevisionFinanciere;
import com.launchpad.prevision.domain.ProjectionFinanciere;
import com.launchpad.prevision.domain.StatutValidation;
import com.launchpad.prevision.domain.ValidationPrevision;

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
    List<PrevisionFinanciere> findByProjetId(Long projetId);

    Optional<PrevisionFinanciere> findLatestByProjetId(Long projetId);

    /** Remplace toutes les projections de la prévision par celles fournies. */
    void replaceProjections(UUID previsionId, List<ProjectionFinanciere> projections);

    /** Enregistre l'avis du financier (ou remet la prévision EN_ATTENTE). */
    void updateValidation(UUID previsionId, ValidationPrevision validation);

    /** Nombre de prévisions du projet dans ce statut. */
    long countByProjetIdAndStatut(Long projetId, StatutValidation statut);
}
