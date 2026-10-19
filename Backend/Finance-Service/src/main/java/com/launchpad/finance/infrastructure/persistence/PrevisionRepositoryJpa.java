package com.launchpad.finance.infrastructure.persistence;

import com.launchpad.finance.domain.model.PrevisionFinanciere;
import com.launchpad.finance.domain.model.ProjectionFinanciere;
import com.launchpad.finance.domain.port.PrevisionRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Patron Adapter : adapte le port PrevisionRepository du Domaine à Spring Data JPA.
 */
@Repository
@Transactional(readOnly = true)
public class PrevisionRepositoryJpa implements PrevisionRepository {

    private final PrevisionJpaRepository previsions;
    private final ProjectionJpaRepository projections;

    public PrevisionRepositoryJpa(PrevisionJpaRepository previsions, ProjectionJpaRepository projections) {
        this.previsions = previsions;
        this.projections = projections;
    }

    @Override
    @Transactional
    public PrevisionFinanciere save(PrevisionFinanciere prevision) {
        previsions.save(versEntite(prevision));
        remplacer(prevision.id(), prevision.projections());
        return prevision;
    }

    @Override
    public Optional<PrevisionFinanciere> findById(UUID previsionId) {
        return previsions.findById(previsionId)
                .map(entite -> versDomaine(entite, projections.findByPrevisionIdOrderByAnneeAsc(previsionId)));
    }

    @Override
    public List<PrevisionFinanciere> findByProjetId(UUID projetId) {
        List<PrevisionEntity> entites = previsions.findByProjetIdOrderByCreatedAtDesc(projetId);
        if (entites.isEmpty()) {
            return List.of();
        }
        Map<UUID, List<ProjectionEntity>> projectionsParPrevision = projections
                .findByPrevisionIdInOrderByAnneeAsc(entites.stream().map(PrevisionEntity::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(ProjectionEntity::getPrevisionId));
        return entites.stream()
                .map(entite -> versDomaine(entite, projectionsParPrevision.getOrDefault(entite.getId(), List.of())))
                .toList();
    }

    @Override
    public Optional<PrevisionFinanciere> findLatestByProjetId(UUID projetId) {
        return previsions.findFirstByProjetIdOrderByCreatedAtDesc(projetId)
                .map(entite -> versDomaine(entite, projections.findByPrevisionIdOrderByAnneeAsc(entite.getId())));
    }

    @Override
    @Transactional
    public void replaceProjections(UUID previsionId, List<ProjectionFinanciere> nouvellesProjections) {
        remplacer(previsionId, nouvellesProjections);
    }

    private void remplacer(UUID previsionId, List<ProjectionFinanciere> nouvellesProjections) {
        projections.deleteByPrevisionId(previsionId);
        projections.saveAll(nouvellesProjections.stream()
                .map(p -> new ProjectionEntity(UUID.randomUUID(), previsionId, p.annee(), p.chiffreAffaires(),
                        p.depenses(), p.marge()))
                .toList());
    }

    private static PrevisionEntity versEntite(PrevisionFinanciere p) {
        return new PrevisionEntity(p.id(), p.projetId(), p.periode(), p.chiffreAffaires(), p.coutsDirects(),
                p.depenses(), p.creeLe());
    }

    private static PrevisionFinanciere versDomaine(PrevisionEntity e, List<ProjectionEntity> projectionsEntites) {
        List<ProjectionFinanciere> projectionsDomaine = projectionsEntites.stream()
                .map(p -> new ProjectionFinanciere(p.getAnnee(), p.getChiffreAffaires(), p.getDepenses(), p.getMarge()))
                .toList();
        return new PrevisionFinanciere(e.getId(), e.getProjetId(), e.getPeriode(), e.getChiffreAffaires(),
                e.getCoutsDirects(), e.getDepenses(), e.getCreatedAt(), projectionsDomaine);
    }
}
