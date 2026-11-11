package com.launchpad.document.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;


/**
 * Client Feign du Prevision-Service (communication SYNCHRONE). Le service est résolu par son nom dans Eureka
 * (équilibrage Spring Cloud LoadBalancer). {@code finance.prevision-service.url}, si renseignée, force une adresse
 * fixe (tests, exécution sans Eureka). Timeouts : spring.cloud.openfeign.client.config.prevision.
 */
@FeignClient(name = "prevision-service", contextId = "prevision", url = "${finance.prevision-service.url:}")
public interface PrevisionFeignClient {

    @GetMapping("/api/finance/projets/{projetId}/synthese")
    PrevisionDistanteFeign.SyntheseJson synthese(@PathVariable("projetId") Long projetId);

    /** Une prévision (dont son statut de validation). */
    @GetMapping("/api/finance/previsions/{previsionId}")
    PrevisionDistanteFeign.SyntheseJson.PrevisionJson prevision(@PathVariable("previsionId") java.util.UUID previsionId);

    /** Droits de l'utilisateur (jeton relayé par RelaisJetonFeign) sur le projet. */
    @GetMapping("/api/finance/projets/{projetId}/acces")
    AccesDistantFeign.DroitsJson acces(@PathVariable("projetId") Long projetId);
}
