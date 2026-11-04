package com.launchpad.document.config;

import com.launchpad.document.service.GenerateurDocsFinanciers;
import com.launchpad.document.service.PrevisionDistante;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Déclare comme bean le générateur de documents, classe métier en Java pur.
 */
@Configuration(proxyBeanMethods = false)
public class MetierConfig {

    @Bean
    GenerateurDocsFinanciers generateurDocsFinanciers(PrevisionDistante previsions) {
        return new GenerateurDocsFinanciers(previsions);
    }
}
