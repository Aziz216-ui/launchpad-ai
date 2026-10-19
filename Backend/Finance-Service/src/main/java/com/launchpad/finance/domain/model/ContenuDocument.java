package com.launchpad.finance.domain.model;

import java.util.List;

/**
 * Contenu structuré d'un document financier, indépendant du format de sortie (JSON, PDF, Excel).
 */
public record ContenuDocument(String titre, List<SectionDocument> sections) {

    public ContenuDocument {
        sections = sections == null ? List.of() : List.copyOf(sections);
    }
}
