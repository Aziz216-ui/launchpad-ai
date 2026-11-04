package com.launchpad.document.client;

import com.launchpad.document.domain.ProjectionSynthese;
import com.launchpad.document.domain.SynthesePrevision;
import com.launchpad.document.exception.PrevisionIntrouvable;
import com.launchpad.document.exception.ServiceIndisponible;
import com.launchpad.document.service.PrevisionDistante;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

/**
 * Client REST léger du Prevision-Service (GET /api/finance/projets/{id}/synthese). Timeout court : un service
 * éteint ou lent est signalé par ServiceIndisponible (503) au lieu de bloquer ou de faire planter le service.
 */
@Component
public class PrevisionDistanteRest implements PrevisionDistante {

    private final ResolveurService resolveur;
    private final String nomService;
    private final String adresseSecours;
    private final RestClient http;

    public PrevisionDistanteRest(ResolveurService resolveur,
                                 @Value("${finance.prevision-service.nom}") String nomService,
                                 @Value("${finance.prevision-service.url}") String adresseSecours,
                                 @Value("${finance.prevision-service.timeout}") Duration timeout) {
        this.resolveur = resolveur;
        this.nomService = nomService;
        this.adresseSecours = adresseSecours;
        SimpleClientHttpRequestFactory fabrique = new SimpleClientHttpRequestFactory();
        fabrique.setConnectTimeout(timeout);
        fabrique.setReadTimeout(timeout);
        this.http = RestClient.builder().requestFactory(fabrique).build();
    }

    @Override
    public SynthesePrevision derniereSynthese(UUID projetId) {
        try {
            SyntheseJson json = http.get()
                    .uri(resolveur.adresse(nomService, adresseSecours) + "/api/finance/projets/{projetId}/synthese",
                            projetId)
                    .retrieve()
                    .body(SyntheseJson.class);
            if (json == null || json.prevision() == null || json.marges() == null || json.ecart() == null) {
                throw new ServiceIndisponible("Réponse inattendue du Prevision-Service");
            }
            return json.versDomaine();
        } catch (HttpClientErrorException e) {
            if (e.getStatusCode() == HttpStatus.NOT_FOUND) {
                throw PrevisionIntrouvable.pourProjet(projetId);
            }
            throw new ServiceIndisponible("Prevision-Service a refusé la requête : " + e.getStatusCode());
        } catch (RestClientException e) {
            throw new ServiceIndisponible("Prevision-Service indisponible : " + e.getMessage());
        }
    }

    /** Forme JSON de SyntheseResponse (Prevision-Service) ; les champs inconnus sont ignorés. */
    record SyntheseJson(PrevisionJson prevision, MargesJson marges, EcartJson ecart) {

        record PrevisionJson(String periode, BigDecimal chiffreAffaires, BigDecimal coutsDirects, BigDecimal depenses,
                             BigDecimal resultat, List<ProjectionJson> projections) {
        }

        record ProjectionJson(int annee, BigDecimal chiffreAffaires, BigDecimal depenses, BigDecimal marge) {
        }

        record MargesJson(BigDecimal margeBrute, BigDecimal margeNette, BigDecimal tauxMargeBrute,
                          BigDecimal tauxMargeNette) {
        }

        record EcartJson(BigDecimal montant, BigDecimal pourcentage, String statut) {
        }

        SynthesePrevision versDomaine() {
            List<ProjectionSynthese> projections = prevision.projections() == null ? List.of()
                    : prevision.projections().stream()
                            .map(p -> new ProjectionSynthese(p.annee(), p.chiffreAffaires(), p.depenses(), p.marge()))
                            .toList();
            return new SynthesePrevision(prevision.periode(), prevision.chiffreAffaires(), prevision.coutsDirects(),
                    prevision.depenses(), prevision.resultat(), marges.margeBrute(), marges.margeNette(),
                    marges.tauxMargeBrute(), marges.tauxMargeNette(), ecart.montant(), ecart.pourcentage(),
                    ecart.statut(), projections);
        }
    }
}
