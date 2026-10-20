package com.launchpad.finance.repository;

import com.launchpad.finance.entities.DocumentEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

interface DocumentJpaRepository extends JpaRepository<DocumentEntity, UUID> {

    List<DocumentEntity> findByProjetIdOrderByCreatedAtDesc(UUID projetId);
}
