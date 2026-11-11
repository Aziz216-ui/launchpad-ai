package com.launchpad.document.domain;

/**
 * Droits de l'utilisateur courant sur un projet, tels que les calcule le Prevision-Service (qui tient la liste
 * des propriétaires et des financiers invités).
 * <ul>
 *   <li>lecture : consulter, exporter les documents et les notifications ;</li>
 *   <li>ecriture : générer et supprimer des documents (propriétaire) ;</li>
 *   <li>validation : certifier un document (financier invité).</li>
 * </ul>
 */
public record DroitsProjet(Long projetId, boolean lecture, boolean ecriture, boolean validation) {

    public static DroitsProjet tous(Long projetId) {
        return new DroitsProjet(projetId, true, true, true);
    }
}
