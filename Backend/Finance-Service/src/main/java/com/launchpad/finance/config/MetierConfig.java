package com.launchpad.finance.config;

import com.launchpad.finance.repository.PrevisionRepository;
import com.launchpad.finance.service.CalculateurMarge;
import com.launchpad.finance.service.ComparateurRevenusDepenses;
import com.launchpad.finance.service.GenerateurDocsFinanciers;
import com.launchpad.finance.service.ModelePrevisionnel;
import com.launchpad.finance.service.strategie.CroissanceParTaux;
import com.launchpad.finance.service.strategie.StrategieProjection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Déclare comme beans les classes métier en Java pur (calculs, modèle prévisionnel, générateur de documents).
 */
@Configuration(proxyBeanMethods = false)
public class MetierConfig {

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
