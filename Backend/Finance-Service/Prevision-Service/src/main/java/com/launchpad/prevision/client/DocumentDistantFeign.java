package com.launchpad.prevision.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.launchpad.prevision.domain.TypeDocument;
import com.launchpad.prevision.exception.ServiceIndisponible;
import com.launchpad.prevision.service.DocumentDistant;
import feign.FeignException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/**
 * Adaptateur du port DocumentDistant : appelle le Document-Service par Feign. Timeout court : un service éteint ou
 * lent ne bloque pas l'assistant, qui reçoit une erreur lisible (ServiceIndisponible) et continue avec ses
 * données locales.
 */
@Component
public class DocumentDistantFeign implements DocumentDistant {

    private static final Logger LOG = LoggerFactory.getLogger(DocumentDistantFeign.class);

    private final DocumentFeignClient documents;

    public DocumentDistantFeign(DocumentFeignClient documents) {
        this.documents = documents;
    }

    @Override
    public UUID genererDocument(Long projetId, TypeDocument type) {
        try {
            JsonNode reponse = documents.generer(Map.of("projetId", projetId, "type", type));
            if (reponse == null || !reponse.hasNonNull("documentId")) {
                throw new ServiceIndisponible("Réponse inattendue du Document-Service");
            }
            return UUID.fromString(reponse.get("documentId").asText());
        } catch (FeignException e) {
            // Le détail (adresse, exception) reste dans les journaux : il n'est pas renvoyé au modèle ni au client.
            LOG.warn("Document-Service injoignable ou en erreur (génération d'un document {} pour le projet {})",
                    type, projetId, e);
            throw new ServiceIndisponible("Le service des documents est momentanément indisponible");
        }
    }
}
