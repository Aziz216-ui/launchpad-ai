package com.launchpad.prevision.domain;

import java.util.Locale;
import java.util.Set;

/**
 * Utilisateur authentifié (jeton Keycloak) : identifiant (sub), e-mail et rôles du realm
 * (ADMIN, ENTREPRENEUR, FINANCIER, ACCOUNTANT, LAWYER).
 */
public record Utilisateur(String id, String email, Set<String> roles) {

    public Utilisateur {
        if (id == null || id.isBlank()) {
            throw new IllegalArgumentException("L'identifiant de l'utilisateur est obligatoire");
        }
        email = normaliserEmail(email);
        roles = roles == null ? Set.of() : Set.copyOf(roles);
    }

    public boolean estAdmin() {
        return roles.contains("ADMIN");
    }

    public boolean estEntrepreneur() {
        return roles.contains("ENTREPRENEUR");
    }

    public boolean estFinancier() {
        return roles.contains("FINANCIER");
    }

    /** Nom affiché comme auteur d'un avis : l'e-mail, à défaut l'identifiant. */
    public String signature() {
        return email != null ? email : id;
    }

    /** E-mail en minuscules sans espaces ; null si absent. */
    public static String normaliserEmail(String email) {
        return email == null || email.isBlank() ? null : email.strip().toLowerCase(Locale.ROOT);
    }
}
