package com.launchpad.document.controller;

import com.launchpad.document.domain.DocumentFinancier;
import com.launchpad.document.domain.FichierExporte;
import com.launchpad.document.domain.FormatExport;
import com.launchpad.document.dto.CertificationRequest;
import com.launchpad.document.dto.CreerDocumentRequest;
import com.launchpad.document.dto.DocumentResponse;
import com.launchpad.document.dto.DocumentResumeResponse;
import com.launchpad.document.service.GestionDocuments;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.UUID;

/**
 * IDocument — documents financiers (scénarios 3 et 4).
 */
@Tag(name = "Documents", description = "Documents financiers et export PDF / Excel")
@RestController
@RequestMapping("/api/finance")
public class DocumentController {

    private final GestionDocuments gestionDocuments;

    public DocumentController(GestionDocuments gestionDocuments) {
        this.gestionDocuments = gestionDocuments;
    }

    @Operation(summary = "Scénario 3 : générer un document financier")
    @PostMapping("/documents")
    public ResponseEntity<DocumentResponse> genererDocument(@Valid @RequestBody CreerDocumentRequest requete) {
        DocumentFinancier document = gestionDocuments.genererDocument(requete.projetId(), requete.type(),
                requete.tresorerieInitiale(), requete.analyseDemandee());
        URI location = ServletUriComponentsBuilder.fromCurrentRequestUri()
                .path("/{id}").buildAndExpand(document.id()).toUri();
        return ResponseEntity.created(location).body(DocumentResponse.depuis(document));
    }

    @Operation(summary = "Scénario 4 : lister les documents d'un projet")
    @GetMapping("/projets/{projetId}/documents")
    public List<DocumentResumeResponse> listerDocuments(@PathVariable Long projetId) {
        return gestionDocuments.listerDocuments(projetId).stream().map(DocumentResumeResponse::depuis).toList();
    }

    @Operation(summary = "Consulter un document et son contenu")
    @GetMapping("/documents/{id}")
    public DocumentResponse consulterDocument(@PathVariable UUID id) {
        return DocumentResponse.depuis(gestionDocuments.consulterDocument(id));
    }

    /** Téléchargement du document au format pdf ou xlsx. */
    @Operation(summary = "Scénario 4 : exporter un document (format=pdf|xlsx)")
    @GetMapping("/documents/{id}/export")
    public ResponseEntity<byte[]> exporterDocument(@PathVariable UUID id, @RequestParam String format) {
        FichierExporte fichier = gestionDocuments.exporterDocument(id, FormatExport.depuisExtension(format));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(fichier.typeContenu()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(fichier.nomFichier()).build().toString())
                .body(fichier.contenu());
    }

    @Operation(summary = "Certifier un document avant son envoi à un investisseur (financier invité sur le projet)")
    @PostMapping("/documents/{id}/certification")
    public DocumentResponse certifierDocument(@PathVariable UUID id,
                                              @Valid @RequestBody(required = false) CertificationRequest requete) {
        String commentaire = requete == null ? null : requete.commentaire();
        return DocumentResponse.depuis(gestionDocuments.certifierDocument(id, commentaire));
    }

    @Operation(summary = "Scénario 4 : supprimer un document et ses fichiers")
    @DeleteMapping("/documents/{id}")
    public ResponseEntity<Void> supprimerDocument(@PathVariable UUID id) {
        gestionDocuments.supprimerDocument(id);
        return ResponseEntity.noContent().build();
    }
}
