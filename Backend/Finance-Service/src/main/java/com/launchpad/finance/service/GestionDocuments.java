package com.launchpad.finance.service;

import com.launchpad.finance.domain.ContenuDocument;
import com.launchpad.finance.domain.DocumentFinancier;
import com.launchpad.finance.domain.FichierExporte;
import com.launchpad.finance.domain.FormatExport;
import com.launchpad.finance.domain.TypeDocument;
import com.launchpad.finance.exception.DocumentIntrouvable;
import com.launchpad.finance.repository.DocumentRepository;
import com.launchpad.finance.service.export.ExporteurFinancier;
import com.launchpad.finance.service.stockage.StockageDocuments;
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
    private final ExporteurFinancier exporteur;
    private final StockageDocuments stockage;

    public GestionDocuments(DocumentRepository documents, GenerateurDocsFinanciers generateur,
                            ExporteurFinancier exporteur, StockageDocuments stockage) {
        this.documents = documents;
        this.generateur = generateur;
        this.exporteur = exporteur;
        this.stockage = stockage;
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

    /** Scénario 4 : exporte le document, conserve le fichier via IDocuments et le renvoie pour téléchargement. */
    public FichierExporte exporterDocument(UUID documentId, FormatExport format) {
        FichierExporte fichier = exporteur.exporter(consulterDocument(documentId), format);
        stockage.enregistrer(format.cleStockage(documentId), fichier.contenu(), fichier.typeContenu());
        return fichier;
    }

    /**
     * Scénario 4 : supprime les fichiers exportés (tous formats) puis l'enregistrement.
     * Les fichiers passent en premier : un échec laisse l'enregistrement, et un export ultérieur les régénère.
     */
    @Transactional
    public void supprimerDocument(UUID documentId) {
        consulterDocument(documentId);
        for (FormatExport format : FormatExport.values()) {
            stockage.supprimer(format.cleStockage(documentId));
        }
        documents.deleteById(documentId);
    }
}
