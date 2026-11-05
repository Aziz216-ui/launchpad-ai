package com.launchpad.prevision.service.ia;

import com.launchpad.prevision.domain.ContenuDocument;
import com.launchpad.prevision.domain.LigneDocument;
import com.launchpad.prevision.domain.SectionDocument;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Scénario 3 (avecAnalyse) : rédige l'analyse d'un document dont les tableaux sont déjà calculés.
 * Appelé par le Document-Service, qui ajoute lui-même la section « Analyse » à son document.
 */
@Service
public class RedacteurIA {

    static final String CONSIGNES = """
            Tu es un analyste financier. À partir des tableaux fournis, rédige en français une analyse \
            de 2 à 4 paragraphes courts, séparés par une ligne vide : points forts, points de vigilance, \
            recommandations. Utilise uniquement les chiffres des tableaux, sans en inventer ni en recalculer.""";

    private final ClientLLM llm;

    public RedacteurIA(ClientLLM llm) {
        this.llm = llm;
    }

    public List<String> analyser(ContenuDocument contenu) {
        String analyse = llm.generer(CONSIGNES, tableaux(contenu));
        return Arrays.stream(analyse.split("\\R\\s*\\R"))
                .map(String::strip)
                .filter(paragraphe -> !paragraphe.isEmpty())
                .toList();
    }

    static String tableaux(ContenuDocument contenu) {
        StringBuilder texte = new StringBuilder(contenu.titre()).append('\n');
        for (SectionDocument section : contenu.sections()) {
            texte.append("\n## ").append(section.titre()).append('\n');
            if (!section.colonnes().isEmpty()) {
                texte.append("Colonnes : ").append(String.join(" | ", section.colonnes())).append('\n');
            }
            for (LigneDocument ligne : section.lignes()) {
                texte.append("- ").append(ligne.libelle()).append(" : ")
                        .append(ligne.valeurs().stream().map(BigDecimal::toPlainString)
                                .collect(Collectors.joining(" | ")))
                        .append('\n');
            }
            section.notes().forEach(note -> texte.append(note).append('\n'));
        }
        return texte.toString();
    }
}
