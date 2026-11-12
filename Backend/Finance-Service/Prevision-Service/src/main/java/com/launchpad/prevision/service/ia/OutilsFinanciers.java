package com.launchpad.prevision.service.ia;

import com.launchpad.prevision.domain.Marges;
import com.launchpad.prevision.domain.PrevisionFinanciere;
import com.launchpad.prevision.domain.TypeDocument;
import com.launchpad.prevision.exception.ExceptionMetier;
import com.launchpad.prevision.service.CalculateurMarge;
import com.launchpad.prevision.service.DocumentDistant;
import com.launchpad.prevision.service.GestionPrevisions;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;

import java.util.Comparator;
import java.util.UUID;

/**
 * Outils proposés au modèle par l'assistant. Une instance est liée à UN projet, fixé côté serveur :
 * le modèle ne peut ni choisir ni changer de projet, quoi que contienne la question de l'utilisateur.
 * Les erreurs métier sont renvoyées au modèle sous forme de texte pour qu'il les explique.
 */
public class OutilsFinanciers {

    private final Long projetId;
    private final GestionPrevisions gestionPrevisions;
    private final CalculateurMarge calculateurMarge;
    private final DocumentDistant documents;

    public OutilsFinanciers(Long projetId, GestionPrevisions gestionPrevisions, CalculateurMarge calculateurMarge,
                            DocumentDistant documents) {
        this.projetId = projetId;
        this.gestionPrevisions = gestionPrevisions;
        this.calculateurMarge = calculateurMarge;
        this.documents = documents;
    }

    @Tool(description = "Calcule les marges brute et nette (montants et taux en % du CA) du projet pour une période. "
            + "Avec une chaîne vide comme période, utilise la prévision la plus récente.")
    // Paramètre obligatoire (chaîne vide = la plus récente) : un paramètre facultatif amène certains modèles à
    // envoyer null, que des fournisseurs à validation stricte (ex. Groq) rejettent (HTTP 400 tool_use_failed).
    public String calculerMarges(@ToolParam(description = "Période de la prévision, par exemple 2026, "
            + "ou chaîne vide \"\" pour la plus récente") String periode) {
        boolean sansPeriode = periode == null || periode.isBlank();
        try {
            PrevisionFinanciere prevision = gestionPrevisions.listerPrevisions(projetId).stream()
                    .filter(p -> sansPeriode || p.periode().equalsIgnoreCase(periode.strip()))
                    .max(Comparator.comparing(PrevisionFinanciere::creeLe))
                    .orElse(null);
            if (prevision == null) {
                return "Aucune prévision trouvée pour ce projet" + (sansPeriode ? "." : " et la période " + periode + ".");
            }
            Marges m = calculateurMarge.calculerMarges(prevision);
            return "Période %s : marge brute %s (%s %% du CA), marge nette %s (%s %% du CA)".formatted(
                    prevision.periode(), m.margeBrute().toPlainString(), m.tauxMargeBrute().toPlainString(),
                    m.margeNette().toPlainString(), m.tauxMargeNette().toPlainString());
        } catch (ExceptionMetier e) {
            return "Erreur : " + e.getMessage();
        }
    }

    @Tool(description = "Génère un document financier pour le projet et renvoie son identifiant.")
    public String genererDocument(@ToolParam(description = "Type : BUSINESS_PLAN, BILAN_OUVERTURE, COMPTE_RESULTAT, "
            + "PLAN_TRESORERIE ou RAPPORT_INVESTISSEUR") String type) {
        TypeDocument typeDocument;
        try {
            typeDocument = TypeDocument.valueOf(type == null ? "" : type.strip().toUpperCase());
        } catch (IllegalArgumentException e) {
            return "Type de document inconnu : " + type;
        }
        try {
            UUID documentId = documents.genererDocument(projetId, typeDocument);
            return "Document « " + typeDocument.libelle() + " » généré, identifiant " + documentId;
        } catch (ExceptionMetier e) {
            return "Erreur : " + e.getMessage();
        }
    }
}
