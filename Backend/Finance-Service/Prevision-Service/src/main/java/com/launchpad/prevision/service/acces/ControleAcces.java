package com.launchpad.prevision.service.acces;

import com.launchpad.prevision.domain.DroitsProjet;
import com.launchpad.prevision.domain.MembreProjet;
import com.launchpad.prevision.domain.RoleProjet;
import com.launchpad.prevision.domain.Utilisateur;
import com.launchpad.prevision.exception.AccesRefuse;
import com.launchpad.prevision.repository.MembreProjetRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/**
 * Qui peut faire quoi sur un projet.
 * <ul>
 *   <li>Propriétaire (l'entrepreneur) : lecture et écriture ;</li>
 *   <li>Financier invité (rôle Keycloak FINANCIER + e-mail invité) : lecture et validation ;</li>
 *   <li>ADMIN : tout ;</li>
 *   <li>Projet sans propriétaire : un ENTREPRENEUR peut l'ouvrir et devient propriétaire à sa première écriture.</li>
 * </ul>
 */
@Service
@Transactional(readOnly = true)
public class ControleAcces {

    /** Auteur affiché pour un avis donné sans utilisateur authentifié (sécurité désactivée). */
    static final String AUTEUR_SYSTEME = "systeme";

    private final MembreProjetRepository membres;
    private final UtilisateurCourant courant;

    public ControleAcces(MembreProjetRepository membres, UtilisateurCourant courant) {
        this.membres = membres;
        this.courant = courant;
    }

    public DroitsProjet droits(Long projetId) {
        Optional<Utilisateur> utilisateur = courant.utilisateur();
        if (utilisateur.isEmpty() || utilisateur.get().estAdmin()) {
            return DroitsProjet.de(projetId, RoleProjet.ADMIN);
        }
        Utilisateur u = utilisateur.get();
        Optional<MembreProjet> proprietaire = membres.findProprietaire(projetId);
        if (proprietaire.isPresent() && proprietaire.get().utilisateurId().equals(u.id())) {
            return DroitsProjet.de(projetId, RoleProjet.PROPRIETAIRE);
        }
        if (u.estFinancier() && u.email() != null && membres.findFinancier(projetId, u.email()).isPresent()) {
            return DroitsProjet.de(projetId, RoleProjet.FINANCIER);
        }
        if (proprietaire.isEmpty() && u.estEntrepreneur()) {
            return DroitsProjet.projetLibre(projetId);
        }
        return DroitsProjet.de(projetId, RoleProjet.AUCUN);
    }

    public void exigerLecture(Long projetId) {
        if (!droits(projetId).lecture()) {
            throw new AccesRefuse("Vous n'avez pas accès au projet " + projetId);
        }
    }

    public void exigerEcriture(Long projetId) {
        if (!droits(projetId).ecriture()) {
            throw new AccesRefuse("Seul le propriétaire du projet " + projetId + " peut le modifier");
        }
    }

    /** Comme exigerEcriture ; si le projet est libre, l'entrepreneur courant en devient propriétaire. */
    @Transactional
    public void exigerEcritureEtReserver(Long projetId) {
        DroitsProjet droits = droits(projetId);
        if (!droits.ecriture()) {
            throw new AccesRefuse("Seul le propriétaire du projet " + projetId + " peut le modifier");
        }
        if (droits.role() == RoleProjet.AUCUN) {
            courant.utilisateur().ifPresent(u -> membres.save(MembreProjet.proprietaire(projetId, u)));
        }
    }

    /** Vérifie le droit de valider et renvoie le nom de l'auteur de l'avis. */
    public String exigerValidation(Long projetId) {
        if (!droits(projetId).validation()) {
            throw new AccesRefuse("Seul un financier invité sur le projet " + projetId + " peut donner son avis");
        }
        return courant.utilisateur().map(Utilisateur::signature).orElse(AUTEUR_SYSTEME);
    }
}
