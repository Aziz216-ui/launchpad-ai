package com.launchpad.prevision.service.acces;

import com.launchpad.prevision.domain.Utilisateur;
import com.launchpad.prevision.repository.MembreProjetRepository;

import java.util.Optional;
import java.util.Set;

import static org.mockito.Mockito.mock;

public final class AccesFixtures {

    public static final Utilisateur ENTREPRENEUR = new Utilisateur("sub-entrepreneur", "fondateur@launchpad.tn",
            Set.of("ENTREPRENEUR"));
    public static final Utilisateur FINANCIER = new Utilisateur("sub-financier", "conseil@launchpad.tn",
            Set.of("FINANCIER"));
    public static final Utilisateur AUTRE_ENTREPRENEUR = new Utilisateur("sub-autre", "autre@launchpad.tn",
            Set.of("ENTREPRENEUR"));

    private AccesFixtures() {
    }

    /** Sans utilisateur authentifié (sécurité désactivée) : tout est permis. */
    public static ControleAcces sansControle() {
        return new ControleAcces(mock(MembreProjetRepository.class), Optional::empty);
    }

    public static UtilisateurCourant connecte(Utilisateur utilisateur) {
        return () -> Optional.of(utilisateur);
    }
}
