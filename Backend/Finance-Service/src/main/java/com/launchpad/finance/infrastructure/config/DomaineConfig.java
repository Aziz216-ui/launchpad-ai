package com.launchpad.finance.infrastructure.config;

import com.launchpad.finance.domain.port.PrevisionRepository;
import com.launchpad.finance.domain.service.CalculateurMarge;
import com.launchpad.finance.domain.service.ComparateurRevenusDepenses;
import com.launchpad.finance.domain.service.GenerateurDocsFinanciers;
import com.launchpad.finance.domain.service.ModelePrevisionnel;
import com.launchpad.finance.domain.strategie.CroissanceParTaux;
import com.launchpad.finance.domain.strategie.StrategieProjection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Déclare les services du Domaine (Java pur, sans annotation Spring) comme beans.
 */
@Configuration(proxyBeanMethods = false)
public class DomaineConfig {

    @Bean
    CalculateurMarge calculateurMarge() {
        return new CalculateurMarge();
    }

    @Bean
    ComparateurRevenusDepenses comparateurRevenusDepenses() {
        return new ComparateurRevenusDepenses();
    }

    /** Variante de projection livrée ; une autre variante se branche ici sans toucher au modèle. */
    @Bean
    StrategieProjection strategieProjection() {
        return new CroissanceParTaux();
    }

    @Bean
    ModelePrevisionnel modelePrevisionnel(StrategieProjection strategieProjection) {
        return new ModelePrevisionnel(strategieProjection);
    }

    @Bean
    GenerateurDocsFinanciers generateurDocsFinanciers(PrevisionRepository previsionRepository,
                                                      CalculateurMarge calculateurMarge,
                                                      ComparateurRevenusDepenses comparateurRevenusDepenses) {
        return new GenerateurDocsFinanciers(previsionRepository, calculateurMarge, comparateurRevenusDepenses);
    }
}
