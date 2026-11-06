package com.launchpad.document.domain;

import java.util.ArrayList;
import java.util.List;

/**
 * Contenu structuré d'un document financier, indépendant du format de sortie (JSON, PDF, Excel).
 */
public record ContenuDocument(String titre, List<SectionDocument> sections) {

    public static final String TITRE_SECTION_ANALYSE = "Analyse (rédigée par IA)";

    public ContenuDocument {
        sections = sections == null ? List.of() : List.copyOf(sections);
    }

    /** Ajoute à la fin une section « Analyse » ; les sections existantes ne sont jamais modifiées. */
    public ContenuDocument avecAnalyse(List<String> paragraphes) {
        List<SectionDocument> avec = new ArrayList<>(sections);
        avec.add(new SectionDocument(TITRE_SECTION_ANALYSE, List.of(), List.of(), paragraphes));
        return new ContenuDocument(titre, avec);
    }
}
