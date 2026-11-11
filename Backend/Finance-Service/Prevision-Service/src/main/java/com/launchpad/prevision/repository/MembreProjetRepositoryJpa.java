package com.launchpad.prevision.repository;

import com.launchpad.prevision.domain.MembreProjet;
import com.launchpad.prevision.domain.RoleProjet;
import com.launchpad.prevision.entities.MembreProjetEntity;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Patron Adapter : adapte le port MembreProjetRepository à Spring Data JPA.
 */
@Repository
@Transactional(readOnly = true)
public class MembreProjetRepositoryJpa implements MembreProjetRepository {

    private final MembreProjetJpaRepository membres;

    public MembreProjetRepositoryJpa(MembreProjetJpaRepository membres) {
        this.membres = membres;
    }

    @Override
    @Transactional
    public MembreProjet save(MembreProjet m) {
        membres.saveAndFlush(new MembreProjetEntity(m.id(), m.projetId(), m.role(), m.utilisateurId(), m.email(),
                m.ajouteLe()));
        return m;
    }

    @Override
    public Optional<MembreProjet> findProprietaire(Long projetId) {
        return membres.findFirstByProjetIdAndRole(projetId, RoleProjet.PROPRIETAIRE).map(MembreProjetRepositoryJpa::versDomaine);
    }

    @Override
    public List<MembreProjet> findFinanciers(Long projetId) {
        return membres.findByProjetIdAndRoleOrderByCreatedAtAsc(projetId, RoleProjet.FINANCIER).stream()
                .map(MembreProjetRepositoryJpa::versDomaine).toList();
    }

    @Override
    public Optional<MembreProjet> findFinancier(Long projetId, String email) {
        return membres.findFirstByProjetIdAndRoleAndEmail(projetId, RoleProjet.FINANCIER, email)
                .map(MembreProjetRepositoryJpa::versDomaine);
    }

    @Override
    public List<MembreProjet> findProprietesDe(String utilisateurId) {
        return membres.findByUtilisateurIdAndRoleOrderByCreatedAtDesc(utilisateurId, RoleProjet.PROPRIETAIRE).stream()
                .map(MembreProjetRepositoryJpa::versDomaine).toList();
    }

    @Override
    public List<MembreProjet> findInvitationsDe(String email) {
        return membres.findByEmailAndRoleOrderByCreatedAtDesc(email, RoleProjet.FINANCIER).stream()
                .map(MembreProjetRepositoryJpa::versDomaine).toList();
    }

    @Override
    @Transactional
    public void delete(MembreProjet membre) {
        membres.deleteById(membre.id());
    }

    private static MembreProjet versDomaine(MembreProjetEntity e) {
        return new MembreProjet(e.getId(), e.getProjetId(), e.getRole(), e.getUtilisateurId(), e.getEmail(),
                e.getCreatedAt());
    }
}
