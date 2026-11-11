package com.launchpad.document.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.launchpad.document.domain.ContenuDocument;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

/**
 * Client Feign de l'IA hébergée par le Prevision-Service. Même service que PrevisionFeignClient mais timeout de
 * lecture plus long (l'appel inclut la réponse du LLM) : d'où un contextId distinct (config "prevision-analyse").
 */
@FeignClient(name = "prevision-service", contextId = "prevision-analyse", url = "${finance.prevision-service.url:}")
public interface AnalyseFeignClient {

    @PostMapping("/api/finance/ia/analyse")
    JsonNode analyser(@RequestBody ContenuDocument contenu);
}
