package com.launchpad.prevision.config;

import com.launchpad.prevision.service.CalculateurMarge;
import com.launchpad.prevision.service.ComparateurRevenusDepenses;
import com.launchpad.prevision.service.ModelePrevisionnel;
import com.launchpad.prevision.service.strategie.CroissanceParTaux;
import com.launchpad.prevision.service.strategie.StrategieProjection;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Déclare comme beans les classes métier en Java pur (calculs, modèle prévisionnel).
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
}
