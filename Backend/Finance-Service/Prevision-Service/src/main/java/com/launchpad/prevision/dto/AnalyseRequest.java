package com.launchpad.prevision.dto;

import com.launchpad.prevision.domain.ContenuDocument;
import com.launchpad.prevision.domain.LigneDocument;
import com.launchpad.prevision.domain.SectionDocument;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

/**
 * Tableaux déjà calculés d'un document, envoyés par le Document-Service pour obtenir l'analyse rédigée par l'IA.
 */
public record AnalyseRequest(@NotBlank String titre, @NotNull @Valid List<Section> sections) {

    public record Section(@NotBlank String titre, List<String> colonnes, @Valid List<Ligne> lignes,
                          List<String> notes) {
    }

    public record Ligne(@NotBlank String libelle, List<BigDecimal> valeurs) {
    }

    public ContenuDocument versDomaine() {
        return new ContenuDocument(titre, sections.stream()
                .map(s -> new SectionDocument(s.titre(), s.colonnes(),
                        s.lignes() == null ? List.of()
                                : s.lignes().stream().map(l -> new LigneDocument(l.libelle(), l.valeurs())).toList(),
                        s.notes()))
                .toList());
    }
}
