package com.launchpad.document.client;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Résout l'adresse d'un microservice via Eureka ; si le registre est injoignable ou ne connaît pas le service,
 * se replie sur l'adresse configurée (API Gateway ou URL directe).
 */
@Component
public class ResolveurService {

    private static final Logger LOG = LoggerFactory.getLogger(ResolveurService.class);

    private final DiscoveryClient discovery;

    public ResolveurService(DiscoveryClient discovery) {
        this.discovery = discovery;
    }

    public String adresse(String nomService, String adresseSecours) {
        try {
            List<ServiceInstance> instances = discovery.getInstances(nomService);
            if (!instances.isEmpty()) {
                return instances.get(ThreadLocalRandom.current().nextInt(instances.size())).getUri().toString();
            }
        } catch (RuntimeException e) {
            LOG.warn("Résolution Eureka de {} impossible, repli sur {} : {}", nomService, adresseSecours,
                    e.getMessage());
        }
        return adresseSecours;
    }
}
