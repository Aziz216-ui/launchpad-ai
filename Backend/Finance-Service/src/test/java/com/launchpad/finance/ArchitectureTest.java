package com.launchpad.finance;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

/**
 * Garde-fou du patron Layers : fait échouer le build si une dépendance remonte entre couches.
 */
@AnalyzeClasses(packages = "com.launchpad.finance", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

    private static final String PRESENTATION = "..finance.presentation..";
    private static final String APPLICATION = "..finance.application..";
    private static final String DOMAIN = "..finance.domain..";
    private static final String INFRASTRUCTURE = "..finance.infrastructure..";

    @ArchTest
    static final ArchRule domaine_sans_spring_ni_jpa = noClasses()
            .that().resideInAPackage(DOMAIN)
            .should().dependOnClassesThat().resideInAnyPackage(
                    "org.springframework..", "jakarta.persistence..", "org.hibernate..")
            .because("le Domaine est du Java pur (patron Layers)")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule domaine_ne_depend_pas_des_couches_superieures = noClasses()
            .that().resideInAPackage(DOMAIN)
            .should().dependOnClassesThat().resideInAnyPackage(APPLICATION, PRESENTATION, INFRASTRUCTURE)
            .because("les dépendances sont dirigées vers le bas uniquement")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule application_sans_infrastructure_ni_presentation = noClasses()
            .that().resideInAPackage(APPLICATION)
            .should().dependOnClassesThat().resideInAnyPackage(INFRASTRUCTURE, PRESENTATION)
            .because("l'Application ne connaît le monde extérieur qu'au travers des ports du Domaine")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule presentation_sans_infrastructure = noClasses()
            .that().resideInAPackage(PRESENTATION)
            .should().dependOnClassesThat().resideInAPackage(INFRASTRUCTURE)
            .because("la Présentation passe par l'Application")
            .allowEmptyShould(true);
}
