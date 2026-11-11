package com.launchpad.document.service.acces;

import com.launchpad.document.domain.DroitsProjet;
import com.launchpad.document.exception.AccesRefuse;
import org.springframework.stereotype.Service;

/**
 * Vérifie les droits de l'utilisateur sur un projet avant chaque cas d'usage sur les documents.
 * Les droits viennent du Prevision-Service ; sans utilisateur authentifié (sécurité désactivée), tout est permis.
 */
@Service
public class ControleAcces {

    static final String AUTEUR_SYSTEME = "systeme";

    private final AccesDistant acces;
    private final UtilisateurCourant courant;

    public ControleAcces(AccesDistant acces, UtilisateurCourant courant) {
        this.acces = acces;
        this.courant = courant;
    }

    public DroitsProjet droits(Long projetId) {
        return courant.signature().isEmpty() ? DroitsProjet.tous(projetId) : acces.droits(projetId);
    }

    /** Vérifie le droit de lecture et renvoie les droits (pour filtrer ce que l'utilisateur voit). */
    public DroitsProjet exigerLecture(Long projetId) {
        DroitsProjet droits = droits(projetId);
        if (!droits.lecture()) {
            throw new AccesRefuse("Vous n'avez pas accès au projet " + projetId);
        }
        return droits;
    }

    public void exigerEcriture(Long projetId) {
        if (!droits(projetId).ecriture()) {
            throw new AccesRefuse("Seul le propriétaire du projet " + projetId + " peut générer ou supprimer "
                    + "ses documents");
        }
    }

    /** Vérifie le droit de certifier et renvoie le nom de l'auteur de la certification. */
    public String exigerValidation(Long projetId) {
        if (!droits(projetId).validation()) {
            throw new AccesRefuse("Seul un financier invité sur le projet " + projetId + " peut certifier "
                    + "ses documents");
        }
        return courant.signature().orElse(AUTEUR_SYSTEME);
    }
}
