package com.launchpad.document.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.launchpad.document.domain.ContenuDocument;
import com.launchpad.document.exception.IaIndisponible;
import com.launchpad.document.exception.ServiceIndisponible;
import com.launchpad.document.service.AnalyseDistante;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Client REST de l'IA du Prevision-Service (POST /api/finance/ia/analyse). Le timeout est plus long que celui des
 * données de prévision : l'appel inclut la réponse du LLM. Un LLM indisponible (503 du Prevision-Service) est
 * relayé comme IaIndisponible ; un Prevision-Service injoignable comme ServiceIndisponible.
 */
@Component
public class AnalyseDistanteRest implements AnalyseDistante {

    private static final Logger LOG = LoggerFactory.getLogger(AnalyseDistanteRest.class);

    private final ResolveurService resolveur;
    private final String nomService;
    private final String adresseSecours;
    private final RestClient http;

    public AnalyseDistanteRest(ResolveurService resolveur,
                               @Value("${finance.prevision-service.nom}") String nomService,
                               @Value("${finance.prevision-service.url}") String adresseSecours,
                               @Value("${finance.prevision-service.timeout}") Duration timeoutConnexion,
                               @Value("${finance.prevision-service.timeout-analyse}") Duration timeoutAnalyse) {
        this.resolveur = resolveur;
        this.nomService = nomService;
        this.adresseSecours = adresseSecours;
        SimpleClientHttpRequestFactory fabrique = new SimpleClientHttpRequestFactory();
        fabrique.setConnectTimeout(timeoutConnexion);
        fabrique.setReadTimeout(timeoutAnalyse);
        this.http = RestClient.builder().requestFactory(fabrique).build();
    }

    @Override
    public List<String> analyser(ContenuDocument contenu) {
        try {
            JsonNode reponse = http.post()
                    .uri(resolveur.adresse(nomService, adresseSecours) + "/api/finance/ia/analyse")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(contenu)
                    .retrieve()
                    .body(JsonNode.class);
            if (reponse == null || !reponse.has("paragraphes")) {
                throw new ServiceIndisponible("Réponse inattendue du Prevision-Service");
            }
            List<String> paragraphes = new ArrayList<>();
            reponse.get("paragraphes").forEach(p -> paragraphes.add(p.asText()));
            return paragraphes;
        } catch (HttpStatusCodeException e) {
            if (e.getStatusCode() == HttpStatus.SERVICE_UNAVAILABLE) {
                throw new IaIndisponible("Le service d'IA est indisponible");
            }
            throw new ServiceIndisponible("Prevision-Service a répondu " + e.getStatusCode());
        } catch (RestClientException e) {
            // Le détail (adresse, exception) reste dans les journaux : il n'est pas renvoyé au client.
            LOG.warn("Prevision-Service injoignable (analyse IA d'un document)", e);
            throw new ServiceIndisponible("Le service des prévisions est momentanément indisponible");
        }
    }
}
