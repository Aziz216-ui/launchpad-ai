package com.launchpad.prevision.repository;

import com.launchpad.prevision.domain.StatutValidation;
import com.launchpad.prevision.entities.PrevisionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface PrevisionJpaRepository extends JpaRepository<PrevisionEntity, UUID> {

    List<PrevisionEntity> findByProjetIdOrderByCreatedAtDesc(Long projetId);

    Optional<PrevisionEntity> findFirstByProjetIdOrderByCreatedAtDesc(Long projetId);

    long countByProjetIdAndStatutValidation(Long projetId, StatutValidation statutValidation);
}
