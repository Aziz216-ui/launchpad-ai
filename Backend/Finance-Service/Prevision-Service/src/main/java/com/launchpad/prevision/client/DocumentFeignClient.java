package com.launchpad.prevision.client;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

import java.util.Map;

/**
 * Client Feign du Document-Service (communication SYNCHRONE), résolu par son nom dans Eureka.
 * {@code finance.document-service.url}, si renseignée, force une adresse fixe (tests, sans Eureka).
 * Timeouts : spring.cloud.openfeign.client.config.document.
 */
@FeignClient(name = "document-service", contextId = "document", url = "${finance.document-service.url:}")
public interface DocumentFeignClient {

    @PostMapping("/api/finance/documents")
    JsonNode generer(@RequestBody Map<String, Object> demande);
}
