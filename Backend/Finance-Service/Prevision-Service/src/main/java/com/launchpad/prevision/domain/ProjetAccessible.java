package com.launchpad.prevision.domain;

import java.time.Instant;

/**
 * Projet visible par l'utilisateur courant (« mes projets ») : son rôle, depuis quand, et le nombre de
 * prévisions qui attendent l'avis d'un financier.
 */
public record ProjetAccessible(Long projetId, RoleProjet role, Instant depuis, long previsionsEnAttente) {
}
