package com.launchpad.document.service;

import com.launchpad.document.domain.Certification;
import com.launchpad.document.domain.ContenuDocument;
import com.launchpad.document.domain.DocumentFinancier;
import com.launchpad.document.domain.DocumentCertifie;
import com.launchpad.document.domain.DocumentGenere;
import com.launchpad.document.domain.EtatPrevision;
import com.launchpad.document.domain.FichierExporte;
import com.launchpad.document.domain.FormatExport;
import com.launchpad.document.domain.TypeDocument;
import com.launchpad.document.exception.DocumentIntrouvable;
import com.launchpad.document.repository.DocumentRepository;
import com.launchpad.document.service.acces.ControleAcces;
import com.launchpad.document.service.export.ExporteurFinancier;
import com.launchpad.document.service.stockage.StockageDocuments;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/**
 * Cas d'usage des scénarios 3 (génération d'un document financier), 4 (consultation, export, suppression) et de
 * la certification par un financier. Le propriétaire du projet génère et supprime ; le financier invité consulte,
 * exporte et certifie.
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
    private final ControleAcces controle;
    private final PrevisionDistante previsions;

    public GestionDocuments(DocumentRepository documents, GenerateurDocsFinanciers generateur,
                            ExporteurFinancier exporteur, StockageDocuments stockage, AnalyseDistante analyse,
                            ApplicationEventPublisher evenements, ControleAcces controle,
                            PrevisionDistante previsions) {
        this.previsions = previsions;
        this.documents = documents;
        this.generateur = generateur;
        this.exporteur = exporteur;
        this.stockage = stockage;
        this.analyse = analyse;
        this.evenements = evenements;
        this.controle = controle;
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
    public DocumentFinancier genererDocument(Long projetId, TypeDocument type, BigDecimal tresorerieInitiale,
                                             boolean avecAnalyse) {
        controle.exigerEcriture(projetId);
        GenerateurDocsFinanciers.DocumentCalcule calcule = generateur.calculer(type, projetId, tresorerieInitiale);
        ContenuDocument contenu = calcule.contenu();
        if (avecAnalyse) {
            contenu = contenu.avecAnalyse(analyse.analyser(contenu));
        }
        DocumentFinancier genere = documents.save(DocumentFinancier.creer(projetId, type, contenu,
                calcule.previsionId(), calcule.empreintePrevision()));
        evenements.publishEvent(DocumentGenere.de(genere));
        return genere;
    }

    public List<DocumentFinancier> listerDocuments(Long projetId) {
        controle.exigerLecture(projetId);
        return documents.findByProjetId(projetId);
    }

    public DocumentFinancier consulterDocument(UUID documentId) {
        DocumentFinancier document = charger(documentId);
        controle.exigerLecture(document.projetId());
        return document;
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
        DocumentFinancier document = charger(documentId);
        controle.exigerEcriture(document.projetId());
        for (FormatExport format : FormatExport.values()) {
            stockage.supprimer(format.cleStockage(documentId));
        }
        documents.deleteById(documentId);
    }

    /**
     * Le financier invité certifie le document avant son envoi à un investisseur (une seule fois), à condition que
     * la prévision dont il est tiré ait été validée ET que ses chiffres n'aient pas changé depuis la génération.
     */
    @Transactional
    public DocumentFinancier certifierDocument(UUID documentId, String commentaire) {
        DocumentFinancier document = charger(documentId);
        String auteur = controle.exigerValidation(document.projetId());
        EtatPrevision prevision = document.previsionId() == null ? null : previsions.etat(document.previsionId());
        DocumentFinancier certifie = document.certifier(new Certification(auteur, commentaire,
                Instant.now().truncatedTo(ChronoUnit.MICROS)), prevision);
        documents.updateCertification(documentId, certifie.certification());
        evenements.publishEvent(DocumentCertifie.de(certifie));
        return certifie;
    }

    private DocumentFinancier charger(UUID documentId) {
        return documents.findById(documentId).orElseThrow(() -> new DocumentIntrouvable(documentId));
    }
}
