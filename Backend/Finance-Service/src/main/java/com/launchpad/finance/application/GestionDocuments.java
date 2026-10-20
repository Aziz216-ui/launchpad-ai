package com.launchpad.finance.application;

import com.launchpad.finance.domain.exception.DocumentIntrouvable;
import com.launchpad.finance.domain.model.ContenuDocument;
import com.launchpad.finance.domain.model.DocumentFinancier;
import com.launchpad.finance.domain.model.TypeDocument;
import com.launchpad.finance.domain.port.DocumentRepository;
import com.launchpad.finance.domain.service.GenerateurDocsFinanciers;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Cas d'usage des scénarios 3 (génération d'un document financier) et 4 (consultation, export, suppression).
 */
@Service
@Transactional(readOnly = true)
public class GestionDocuments {

    private final DocumentRepository documents;
    private final GenerateurDocsFinanciers generateur;

    public GestionDocuments(DocumentRepository documents, GenerateurDocsFinanciers generateur) {
        this.documents = documents;
        this.generateur = generateur;
    }

    /** Scénario 3 : les tableaux sont calculés par le générateur, puis le document est sauvegardé. */
    @Transactional
    public DocumentFinancier genererDocument(UUID projetId, TypeDocument type, BigDecimal tresorerieInitiale) {
        ContenuDocument contenu = generateur.generer(type, projetId, tresorerieInitiale);
        return documents.save(DocumentFinancier.creer(projetId, type, contenu));
    }

    public List<DocumentFinancier> listerDocuments(UUID projetId) {
        return documents.findByProjetId(projetId);
    }

    public DocumentFinancier consulterDocument(UUID documentId) {
        return documents.findById(documentId).orElseThrow(() -> new DocumentIntrouvable(documentId));
    }
}
