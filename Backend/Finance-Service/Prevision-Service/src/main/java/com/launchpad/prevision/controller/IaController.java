package com.launchpad.prevision.controller;

import com.launchpad.prevision.dto.AnalyseRequest;
import com.launchpad.prevision.dto.AnalyseResponse;
import com.launchpad.prevision.dto.CommentaireResponse;
import com.launchpad.prevision.dto.QuestionRequest;
import com.launchpad.prevision.dto.ReponseAssistantResponse;
import com.launchpad.prevision.service.ia.AssistantFinancier;
import com.launchpad.prevision.service.ia.CommentateurEcart;
import com.launchpad.prevision.service.ia.RedacteurIA;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * IPrevision — fonctions rédigées par l'IA : commentaire d'écart, assistant financier et analyse de document.
 * Répondent 503 si le fournisseur LLM est indisponible ; les autres endpoints ne sont pas affectés.
 */
@Tag(name = "IA", description = "Commentaire d'écart, assistant financier et analyse de document")
@RestController
@RequestMapping("/api/finance")
public class IaController {

    private final CommentateurEcart commentateurEcart;
    private final AssistantFinancier assistantFinancier;
    private final RedacteurIA redacteurIA;

    public IaController(CommentateurEcart commentateurEcart, AssistantFinancier assistantFinancier,
                        RedacteurIA redacteurIA) {
        this.commentateurEcart = commentateurEcart;
        this.assistantFinancier = assistantFinancier;
        this.redacteurIA = redacteurIA;
    }

    @Operation(summary = "Scénario 1 (c) : commenter l'écart revenus / dépenses en langage clair")
    @PostMapping("/previsions/{id}/commentaire")
    public CommentaireResponse commenterEcart(@PathVariable UUID id) {
        return new CommentaireResponse(id, commentateurEcart.commenter(id));
    }

    @Operation(summary = "Assistant financier : poser une question sur les finances d'un projet")
    @PostMapping("/projets/{projetId}/assistant")
    public ReponseAssistantResponse poserQuestion(@PathVariable Long projetId,
                                                  @Valid @RequestBody QuestionRequest requete) {
        return new ReponseAssistantResponse(projetId, assistantFinancier.repondre(projetId, requete.message()));
    }

    @Operation(summary = "Scénario 3 (analyse) : rédiger l'analyse d'un document (appelé par le Document-Service)")
    @PostMapping("/ia/analyse")
    public AnalyseResponse analyserDocument(@Valid @RequestBody AnalyseRequest requete) {
        return new AnalyseResponse(redacteurIA.analyser(requete.versDomaine()));
    }
}
