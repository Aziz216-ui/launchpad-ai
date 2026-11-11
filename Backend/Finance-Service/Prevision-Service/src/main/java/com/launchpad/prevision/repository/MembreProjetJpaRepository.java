package com.launchpad.prevision.repository;

import com.launchpad.prevision.domain.RoleProjet;
import com.launchpad.prevision.entities.MembreProjetEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface MembreProjetJpaRepository extends JpaRepository<MembreProjetEntity, UUID> {

    Optional<MembreProjetEntity> findFirstByProjetIdAndRole(Long projetId, RoleProjet role);

    List<MembreProjetEntity> findByProjetIdAndRoleOrderByCreatedAtAsc(Long projetId, RoleProjet role);

    Optional<MembreProjetEntity> findFirstByProjetIdAndRoleAndEmail(Long projetId, RoleProjet role, String email);

    List<MembreProjetEntity> findByUtilisateurIdAndRoleOrderByCreatedAtDesc(String utilisateurId, RoleProjet role);

    List<MembreProjetEntity> findByEmailAndRoleOrderByCreatedAtDesc(String email, RoleProjet role);
}
