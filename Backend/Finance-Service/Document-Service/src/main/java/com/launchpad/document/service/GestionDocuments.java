package com.launchpad.document.service;

import com.launchpad.document.domain.ContenuDocument;
import com.launchpad.document.domain.DocumentFinancier;
import com.launchpad.document.domain.DocumentGenere;
import com.launchpad.document.domain.FichierExporte;
import com.launchpad.document.domain.FormatExport;
import com.launchpad.document.domain.TypeDocument;
import com.launchpad.document.exception.DocumentIntrouvable;
import com.launchpad.document.repository.DocumentRepository;
import com.launchpad.document.service.export.ExporteurFinancier;
import com.launchpad.document.service.stockage.StockageDocuments;
import org.springframework.context.ApplicationEventPublisher;
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
    private final AnalyseDistante analyse;
    private final ApplicationEventPublisher evenements;

    public GestionDocuments(DocumentRepository documents, GenerateurDocsFinanciers generateur,
                            ExporteurFinancier exporteur, StockageDocuments stockage, AnalyseDistante analyse,
                            ApplicationEventPublisher evenements) {
        this.documents = documents;
        this.generateur = generateur;
        this.exporteur = exporteur;
        this.stockage = stockage;
        this.analyse = analyse;
        this.evenements = evenements;
    }

    /**
     * Scénario 3 : les tableaux sont toujours calculés par le générateur ; si avecAnalyse, l'IA (via le
     * Prevision-Service) y ajoute une section « Analyse ». Le document est sauvegardé après l'appel IA, et pas du
     * tout si celui-ci échoue.
     * Note : les appels distants (Prevision-Service, LLM) ont lieu dans la transaction ; leur durée est bornée par
     * les timeouts des clients HTTP.
     * Un événement DocumentGenere est ensuite publié ; il n'atteint RabbitMQ qu'une fois la transaction validée.
     */
    @Transactional
    public DocumentFinancier genererDocument(UUID projetId, TypeDocument type, BigDecimal tresorerieInitiale,
                                             boolean avecAnalyse) {
        ContenuDocument contenu = generateur.generer(type, projetId, tresorerieInitiale);
        if (avecAnalyse) {
            contenu = contenu.avecAnalyse(analyse.analyser(contenu));
        }
        DocumentFinancier genere = documents.save(DocumentFinancier.creer(projetId, type, contenu));
        evenements.publishEvent(DocumentGenere.de(genere));
        return genere;
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
