package com.launchpad.finance;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

/**
 * Garde-fou de la structure du service : fait échouer le build si une dépendance interdite apparaît
 * entre les packages config, controller, domain, dto, entities, exception, repository et service.
 */
@AnalyzeClasses(packages = "com.launchpad.finance", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    private static final String CONTROLLER = "..finance.controller..";
    private static final String DOMAIN = "..finance.domain..";
    private static final String DTO = "..finance.dto..";
    private static final String ENTITIES = "..finance.entities..";
    private static final String REPOSITORY = "..finance.repository..";
    private static final String SERVICE = "..finance.service..";
    private static final String CONFIG = "..finance.config..";

    @ArchTest
    static final ArchRule domaine_sans_spring_ni_jpa = noClasses()
            .that().resideInAPackage(DOMAIN)
            .should().dependOnClassesThat().resideInAnyPackage(
                    "org.springframework..", "jakarta.persistence..", "org.hibernate..")
            .because("le modèle métier est du Java pur");

    @ArchTest
    static final ArchRule domaine_independant_des_autres_packages = noClasses()
            .that().resideInAPackage(DOMAIN)
            .should().dependOnClassesThat().resideInAnyPackage(
                    CONTROLLER, DTO, ENTITIES, REPOSITORY, SERVICE, CONFIG)
            .because("le modèle métier ne dépend que de lui-même et des exceptions métier");

    @ArchTest
    static final ArchRule controleurs_passent_par_les_services = noClasses()
            .that().resideInAPackage(CONTROLLER)
            .should().dependOnClassesThat().resideInAnyPackage(REPOSITORY, ENTITIES)
            .because("un contrôleur (MVC) délègue aux services, jamais à la persistance");

    @ArchTest
    static final ArchRule services_ignorent_le_web = noClasses()
            .that().resideInAPackage(SERVICE)
            .should().dependOnClassesThat().resideInAnyPackage(CONTROLLER, DTO)
            .because("les services ne connaissent ni les contrôleurs ni les DTO REST");

    @ArchTest
    static final ArchRule entites_jpa_reservees_aux_repositories = classes()
            .that().resideInAPackage(ENTITIES)
            .should().onlyBeAccessed().byAnyPackage(ENTITIES, REPOSITORY)
            .because("patron Adapter : seuls les adaptateurs de persistance manipulent les entités JPA");
}
