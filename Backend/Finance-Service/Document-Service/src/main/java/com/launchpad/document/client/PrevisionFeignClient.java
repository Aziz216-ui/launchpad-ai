package com.launchpad.document.client;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.UUID;

/**
 * Client Feign du Prevision-Service (communication SYNCHRONE). Le service est résolu par son nom dans Eureka
 * (équilibrage Spring Cloud LoadBalancer). {@code finance.prevision-service.url}, si renseignée, force une adresse
 * fixe (tests, exécution sans Eureka). Timeouts : spring.cloud.openfeign.client.config.prevision.
 */
@FeignClient(name = "prevision-service", contextId = "prevision", url = "${finance.prevision-service.url:}")
public interface PrevisionFeignClient {

    @GetMapping("/api/finance/projets/{projetId}/synthese")
    PrevisionDistanteFeign.SyntheseJson synthese(@PathVariable("projetId") Long projetId);
}
