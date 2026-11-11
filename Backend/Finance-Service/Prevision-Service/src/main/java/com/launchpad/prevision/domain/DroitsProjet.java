package com.launchpad.prevision.domain;

/**
 * Ce que l'utilisateur courant peut faire sur un projet.
 * <ul>
 *   <li>lecture : consulter prévisions, marges, écarts, projections et documents ;</li>
 *   <li>ecriture : saisir des prévisions, générer projections et documents, inviter des financiers ;</li>
 *   <li>validation : valider ou rejeter une prévision, certifier un document.</li>
 * </ul>
 * Un projet sans propriétaire est « libre » : un entrepreneur peut y écrire, et en devient alors propriétaire.
 */
public record DroitsProjet(Long projetId, RoleProjet role, boolean lecture, boolean ecriture, boolean validation) {

    public static DroitsProjet de(Long projetId, RoleProjet role) {
        return switch (role) {
            case PROPRIETAIRE -> new DroitsProjet(projetId, role, true, true, false);
            case FINANCIER -> new DroitsProjet(projetId, role, true, false, true);
            case ADMIN -> new DroitsProjet(projetId, role, true, true, true);
            case AUCUN -> new DroitsProjet(projetId, role, false, false, false);
        };
    }

    /** Projet libre vu par un entrepreneur : rien à lire pour l'instant, mais il peut le démarrer. */
    public static DroitsProjet projetLibre(Long projetId) {
        return new DroitsProjet(projetId, RoleProjet.AUCUN, true, true, false);
    }
}
