package com.launchpad.finance.repository;

import com.launchpad.finance.entities.PrevisionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface PrevisionJpaRepository extends JpaRepository<PrevisionEntity, UUID> {

    List<PrevisionEntity> findByProjetIdOrderByCreatedAtDesc(UUID projetId);

    Optional<PrevisionEntity> findFirstByProjetIdOrderByCreatedAtDesc(UUID projetId);
}
