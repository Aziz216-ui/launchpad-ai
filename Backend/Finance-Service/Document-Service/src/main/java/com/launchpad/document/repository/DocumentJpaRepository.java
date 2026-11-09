package com.launchpad.document.repository;

import com.launchpad.document.entities.DocumentEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

interface DocumentJpaRepository extends JpaRepository<DocumentEntity, UUID> {

    List<DocumentEntity> findByProjetIdOrderByCreatedAtDesc(Long projetId);
}
