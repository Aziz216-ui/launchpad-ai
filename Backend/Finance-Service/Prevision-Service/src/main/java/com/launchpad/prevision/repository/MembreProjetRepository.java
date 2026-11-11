package com.launchpad.prevision.repository;

import com.launchpad.prevision.domain.MembreProjet;

import java.util.List;
import java.util.Optional;

/**
 * Port de persistance des membres d'un projet (propriétaire et financiers invités).
 */
public interface MembreProjetRepository {

    MembreProjet save(MembreProjet membre);

    Optional<MembreProjet> findProprietaire(Long projetId);

    /** Financiers invités sur le projet, du plus ancien au plus récent. */
    List<MembreProjet> findFinanciers(Long projetId);

    Optional<MembreProjet> findFinancier(Long projetId, String email);

    /** Projets dont l'utilisateur est propriétaire. */
    List<MembreProjet> findProprietesDe(String utilisateurId);

    /** Projets sur lesquels cet e-mail est invité comme financier. */
    List<MembreProjet> findInvitationsDe(String email);

    void delete(MembreProjet membre);
}
