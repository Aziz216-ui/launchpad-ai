package com.launchpad.finance.domain.model;

import java.util.List;

/**
 * Section d'un document : un tableau (colonnes numériques, une ligne par libellé) et des notes textuelles.
 */
public record SectionDocument(String titre, List<String> colonnes, List<LigneDocument> lignes, List<String> notes) {

    public SectionDocument {
        colonnes = colonnes == null ? List.of() : List.copyOf(colonnes);
        lignes = lignes == null ? List.of() : List.copyOf(lignes);
        notes = notes == null ? List.of() : List.copyOf(notes);
    }
}
