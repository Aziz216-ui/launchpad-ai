package com.launchpad.prevision.controller;

import com.launchpad.prevision.dto.DroitsResponse;
import com.launchpad.prevision.dto.InvitationRequest;
import com.launchpad.prevision.dto.MembreResponse;
import com.launchpad.prevision.dto.ProjetAccessibleResponse;
import com.launchpad.prevision.service.acces.ControleAcces;
import com.launchpad.prevision.service.acces.GestionEquipe;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Rôles sur un projet : droits de l'utilisateur courant, projets accessibles, financiers invités.
 */
@Tag(name = "Équipe", description = "Propriétaire, financiers invités et droits sur un projet")
@RestController
@RequestMapping("/api/finance")
public class EquipeController {

    private final GestionEquipe gestionEquipe;
    private final ControleAcces controleAcces;

    public EquipeController(GestionEquipe gestionEquipe, ControleAcces controleAcces) {
        this.gestionEquipe = gestionEquipe;
        this.controleAcces = controleAcces;
    }

    @Operation(summary = "Droits de l'utilisateur courant sur un projet (rôle, lecture, écriture, validation)")
    @GetMapping("/projets/{projetId}/acces")
    public DroitsResponse droits(@PathVariable Long projetId) {
        return DroitsResponse.depuis(controleAcces.droits(projetId));
    }

    @Operation(summary = "Projets de l'utilisateur courant : possédés (entrepreneur) ou suivis (financier)")
    @GetMapping("/mes-projets")
    public List<ProjetAccessibleResponse> mesProjets() {
        return gestionEquipe.mesProjets().stream().map(ProjetAccessibleResponse::depuis).toList();
    }

    @Operation(summary = "Financiers invités sur le projet")
    @GetMapping("/projets/{projetId}/financiers")
    public List<MembreResponse> financiers(@PathVariable Long projetId) {
        return gestionEquipe.listerFinanciers(projetId).stream().map(MembreResponse::depuis).toList();
    }

    @Operation(summary = "Inviter un financier par e-mail (propriétaire du projet)")
    @PostMapping("/projets/{projetId}/financiers")
    public ResponseEntity<MembreResponse> inviter(@PathVariable Long projetId,
                                                  @Valid @RequestBody InvitationRequest requete) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(MembreResponse.depuis(gestionEquipe.inviterFinancier(projetId, requete.email())));
    }

    @Operation(summary = "Retirer un financier du projet (propriétaire du projet)")
    @DeleteMapping("/projets/{projetId}/financiers/{email}")
    public ResponseEntity<Void> retirer(@PathVariable Long projetId, @PathVariable String email) {
        gestionEquipe.retirerFinancier(projetId, email);
        return ResponseEntity.noContent().build();
    }
}
