package com.launchpad.finance.infrastructure.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

interface ProjectionJpaRepository extends JpaRepository<ProjectionEntity, UUID> {

    List<ProjectionEntity> findByPrevisionIdOrderByAnneeAsc(UUID previsionId);

    List<ProjectionEntity> findByPrevisionIdInOrderByAnneeAsc(Collection<UUID> previsionIds);

    /** Suppression immédiate en base, pour libérer la contrainte unique (prevision_id, annee) avant réinsertion. */
    @Modifying(flushAutomatically = true)
    @Query("delete from ProjectionEntity p where p.previsionId = :previsionId")
    int deleteByPrevisionId(@Param("previsionId") UUID previsionId);
}
