package com.launchpad.document.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.launchpad.document.domain.ContenuDocument;
import com.launchpad.document.exception.IaIndisponible;
import com.launchpad.document.exception.ServiceIndisponible;
import com.launchpad.document.service.AnalyseDistante;
import feign.FeignException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Adaptateur du port AnalyseDistante : appelle l'IA du Prevision-Service par Feign (POST /api/finance/ia/analyse).
 * Un LLM indisponible (503 du Prevision-Service) est relayé comme IaIndisponible ; un Prevision-Service injoignable
 * ou en erreur comme ServiceIndisponible.
 */
@Component
public class AnalyseDistanteFeign implements AnalyseDistante {

    private static final Logger LOG = LoggerFactory.getLogger(AnalyseDistanteFeign.class);

    private final AnalyseFeignClient analyses;

    public AnalyseDistanteFeign(AnalyseFeignClient analyses) {
        this.analyses = analyses;
    }

    @Override
    public List<String> analyser(ContenuDocument contenu) {
        try {
            JsonNode reponse = analyses.analyser(contenu);
            if (reponse == null || !reponse.has("paragraphes")) {
                throw new ServiceIndisponible("Réponse inattendue du Prevision-Service");
            }
            List<String> paragraphes = new ArrayList<>();
            reponse.get("paragraphes").forEach(p -> paragraphes.add(p.asText()));
            return paragraphes;
        } catch (FeignException e) {
            if (e.status() == 503) {
                throw new IaIndisponible("Le service d'IA est indisponible");
            }
            if (e.status() > 0) {
                throw new ServiceIndisponible("Prevision-Service a répondu " + e.status());
            }
            // Le détail (adresse, exception) reste dans les journaux : il n'est pas renvoyé au client.
            LOG.warn("Prevision-Service injoignable (analyse IA d'un document)", e);
            throw new ServiceIndisponible("Le service des prévisions est momentanément indisponible");
        }
    }
}
