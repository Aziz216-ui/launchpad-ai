package com.launchpad.prevision.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.launchpad.prevision.domain.TypeDocument;
import com.launchpad.prevision.exception.ServiceIndisponible;
import com.launchpad.prevision.service.DocumentDistant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

/**
 * Client REST léger du Document-Service. Timeout court : un service éteint ou lent ne bloque pas l'assistant,
 * qui reçoit une erreur lisible (ServiceIndisponible) et continue avec ses données locales.
 */
@Component
public class DocumentDistantRest implements DocumentDistant {

    private static final Logger LOG = LoggerFactory.getLogger(DocumentDistantRest.class);

    private final ResolveurService resolveur;
    private final String nomService;
    private final String adresseSecours;
    private final RestClient http;

    public DocumentDistantRest(ResolveurService resolveur,
                               @Value("${finance.document-service.nom}") String nomService,
                               @Value("${finance.document-service.url}") String adresseSecours,
                               @Value("${finance.document-service.timeout}") Duration timeout) {
        this.resolveur = resolveur;
        this.nomService = nomService;
        this.adresseSecours = adresseSecours;
        SimpleClientHttpRequestFactory fabrique = new SimpleClientHttpRequestFactory();
        fabrique.setConnectTimeout(timeout);
        fabrique.setReadTimeout(timeout);
        this.http = RestClient.builder().requestFactory(fabrique).build();
    }

    @Override
    public UUID genererDocument(UUID projetId, TypeDocument type) {
        try {
            JsonNode reponse = http.post()
                    .uri(resolveur.adresse(nomService, adresseSecours) + "/api/finance/documents")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("projetId", projetId, "type", type))
                    .retrieve()
                    .body(JsonNode.class);
            if (reponse == null || !reponse.hasNonNull("documentId")) {
                throw new ServiceIndisponible("Réponse inattendue du Document-Service");
            }
            return UUID.fromString(reponse.get("documentId").asText());
        } catch (RestClientException e) {
            // Le détail (adresse, exception) reste dans les journaux : il n'est pas renvoyé au modèle ni au client.
            LOG.warn("Document-Service injoignable (génération d'un document {} pour le projet {})", type, projetId, e);
            throw new ServiceIndisponible("Le service des documents est momentanément indisponible");
        }
    }
}
