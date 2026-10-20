package com.launchpad.finance.presentation;

import com.launchpad.finance.application.GestionDocuments;
import com.launchpad.finance.domain.model.DocumentFinancier;
import com.launchpad.finance.presentation.dto.CreerDocumentRequest;
import com.launchpad.finance.presentation.dto.DocumentResponse;
import com.launchpad.finance.presentation.dto.DocumentResumeResponse;
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
 * IFinance — documents financiers (scénarios 3 et 4).
 */
@RestController
@RequestMapping("/api/finance")
public class DocumentController {

    private final GestionDocuments gestionDocuments;

    public DocumentController(GestionDocuments gestionDocuments) {
        this.gestionDocuments = gestionDocuments;
    }

    @PostMapping("/documents")
    public ResponseEntity<DocumentResponse> genererDocument(@Valid @RequestBody CreerDocumentRequest requete) {
        DocumentFinancier document = gestionDocuments.genererDocument(requete.projetId(), requete.type(),
                requete.tresorerieInitiale());
        URI location = ServletUriComponentsBuilder.fromCurrentRequestUri()
                .path("/{id}").buildAndExpand(document.id()).toUri();
        return ResponseEntity.created(location).body(DocumentResponse.depuis(document));
    }

    @GetMapping("/projets/{projetId}/documents")
    public List<DocumentResumeResponse> listerDocuments(@PathVariable UUID projetId) {
        return gestionDocuments.listerDocuments(projetId).stream().map(DocumentResumeResponse::depuis).toList();
    }

    @GetMapping("/documents/{id}")
    public DocumentResponse consulterDocument(@PathVariable UUID id) {
        return DocumentResponse.depuis(gestionDocuments.consulterDocument(id));
    }
}
