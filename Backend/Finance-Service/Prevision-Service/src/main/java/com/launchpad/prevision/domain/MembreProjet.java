package com.launchpad.prevision.domain;

import com.launchpad.prevision.exception.DonneesInvalides;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Membre d'un projet côté Finance. Le propriétaire est reconnu par son identifiant Keycloak (sub) ;
 * un financier par son e-mail, car l'entrepreneur l'invite avant même que le financier se soit connecté.
 */
public record MembreProjet(UUID id, Long projetId, RoleProjet role, String utilisateurId, String email,
                           Instant ajouteLe) {

    public static final int EMAIL_LONGUEUR_MAX = 320;
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    public MembreProjet {
        if (id == null || projetId == null || role == null || ajouteLe == null) {
            throw new DonneesInvalides("Membre de projet incomplet");
        }
        email = Utilisateur.normaliserEmail(email);
        if (role == RoleProjet.PROPRIETAIRE && (utilisateurId == null || utilisateurId.isBlank())) {
            throw new DonneesInvalides("Le propriétaire doit être identifié");
        }
        if (role == RoleProjet.FINANCIER) {
            if (email == null) {
                throw new DonneesInvalides("email est obligatoire");
            }
            if (email.length() > EMAIL_LONGUEUR_MAX || !EMAIL.matcher(email).matches()) {
                throw new DonneesInvalides("email invalide : " + email);
            }
        }
        if (role == RoleProjet.ADMIN || role == RoleProjet.AUCUN) {
            throw new DonneesInvalides("Un membre de projet est PROPRIETAIRE ou FINANCIER");
        }
    }

    public static MembreProjet proprietaire(Long projetId, Utilisateur utilisateur) {
        return new MembreProjet(UUID.randomUUID(), projetId, RoleProjet.PROPRIETAIRE, utilisateur.id(),
                utilisateur.email(), maintenant());
    }

    public static MembreProjet financier(Long projetId, String email) {
        return new MembreProjet(UUID.randomUUID(), projetId, RoleProjet.FINANCIER, null, email, maintenant());
    }

    private static Instant maintenant() {
        return Instant.now().truncatedTo(ChronoUnit.MICROS);
    }
}
