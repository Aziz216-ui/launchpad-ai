package com.launchpad.finance.controller;

import com.launchpad.finance.domain.PrevisionFinanciere;
import com.launchpad.finance.dto.CreerPrevisionRequest;
import com.launchpad.finance.dto.EcartResponse;
import com.launchpad.finance.dto.GenererProjectionsRequest;
import com.launchpad.finance.dto.MargesResponse;
import com.launchpad.finance.dto.PrevisionResponse;
import com.launchpad.finance.dto.ProjectionResponse;
import com.launchpad.finance.service.GestionPrevisions;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.UUID;

/**
 * IFinance — prévisions, marges, écarts et projections (scénarios 1 et 2).
 */
@Tag(name = "Prévisions", description = "Prévisions, marges, écarts et projections")
@RestController
@RequestMapping("/api/finance")
public class PrevisionController {

    private final GestionPrevisions gestionPrevisions;

    public PrevisionController(GestionPrevisions gestionPrevisions) {
        this.gestionPrevisions = gestionPrevisions;
    }

    @Operation(summary = "Scénario 1 : créer une prévision (résultat = CA - dépenses)")
    @PostMapping("/previsions")
    public ResponseEntity<PrevisionResponse> creerPrevision(@Valid @RequestBody CreerPrevisionRequest requete) {
        PrevisionFinanciere prevision = gestionPrevisions.creerPrevision(requete.projetId(), requete.periode(),
                requete.chiffreAffaires(), requete.coutsDirects(), requete.depenses());
        URI location = ServletUriComponentsBuilder.fromCurrentRequestUri()
                .path("/{id}").buildAndExpand(prevision.id()).toUri();
        return ResponseEntity.created(location).body(PrevisionResponse.depuis(prevision));
    }

    @Operation(summary = "Consulter une prévision et ses projections")
    @GetMapping("/previsions/{id}")
    public PrevisionResponse consulterPrevision(@PathVariable UUID id) {
        return PrevisionResponse.depuis(gestionPrevisions.consulterPrevision(id));
    }

    @Operation(summary = "Prévisions d'un projet (utilisé par l'Espace Comptable)")
    @GetMapping("/projets/{projetId}/previsions")
    public List<PrevisionResponse> listerPrevisions(@PathVariable UUID projetId) {
        return gestionPrevisions.listerPrevisions(projetId).stream().map(PrevisionResponse::depuis).toList();
    }

    @Operation(summary = "Scénario 1 (a) : marges brute et nette, taux en %")
    @GetMapping("/previsions/{id}/marges")
    public MargesResponse consulterMarges(@PathVariable UUID id) {
        return MargesResponse.depuis(id, gestionPrevisions.consulterMarges(id));
    }

    @Operation(summary = "Scénario 1 (b) : écart revenus / dépenses (utilisé par le Tableau de bord Comptable)")
    @GetMapping("/previsions/{id}/ecart")
    public EcartResponse comparerRevenusDepenses(@PathVariable UUID id) {
        return EcartResponse.depuis(id, gestionPrevisions.comparerRevenusDepenses(id));
    }

    @Operation(summary = "Scénario 2 : générer les projections pluriannuelles (remplace les anciennes)")
    @PostMapping("/previsions/{id}/projections")
    public ResponseEntity<List<ProjectionResponse>> genererProjections(@PathVariable UUID id,
                                                                       @Valid @RequestBody GenererProjectionsRequest requete) {
        List<ProjectionResponse> projections = gestionPrevisions
                .genererProjections(id, requete.tauxCa(), requete.tauxDepenses(), requete.horizon())
                .stream().map(ProjectionResponse::depuis).toList();
        return ResponseEntity.created(ServletUriComponentsBuilder.fromCurrentRequestUri().build().toUri())
                .body(projections);
    }

    @Operation(summary = "Consulter les projections d'une prévision")
    @GetMapping("/previsions/{id}/projections")
    public List<ProjectionResponse> consulterProjections(@PathVariable UUID id) {
        return gestionPrevisions.consulterProjections(id).stream().map(ProjectionResponse::depuis).toList();
    }
}
