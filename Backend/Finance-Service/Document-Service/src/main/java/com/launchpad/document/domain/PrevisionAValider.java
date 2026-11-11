package com.launchpad.document.domain;

import java.time.Instant;
import java.util.UUID;

/**
 * Événement reçu du Prevision-Service (clé finance.prevision.a-valider) : une prévision attend l'avis d'un
 * financier. Contrat JSON : voir CONTRAT-API.md.
 */
public record PrevisionAValider(UUID evenementId, UUID previsionId, Long projetId, String periode, Instant le) {
}
