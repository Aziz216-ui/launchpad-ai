package com.launchpad.prevision.service.ia;

import com.launchpad.prevision.exception.DonneesInvalides;
import com.launchpad.prevision.service.CalculateurMarge;
import com.launchpad.prevision.service.DocumentDistant;
import com.launchpad.prevision.service.GestionPrevisions;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Répond aux questions de l'entrepreneur sur les finances de son projet.
 * Le modèle appelle les OutilsFinanciers du projet puis rédige sa réponse à partir de leurs résultats.
 */
@Service
public class AssistantFinancier {

    public static final int MESSAGE_LONGUEUR_MAX = 2000;

    static final String CONSIGNES = """
            Tu es l'assistant financier de LaunchPad. Réponds en français, de façon concise. \
            Pour tout chiffre (marges, taux) ou pour générer un document, appelle les outils fournis ; \
            n'invente jamais de chiffre. Si les outils ne permettent pas de répondre, dis-le simplement.""";

    private final ClientLLM llm;
    private final GestionPrevisions gestionPrevisions;
    private final CalculateurMarge calculateurMarge;
    private final DocumentDistant documents;

    public AssistantFinancier(ClientLLM llm, GestionPrevisions gestionPrevisions, CalculateurMarge calculateurMarge,
                              DocumentDistant documents) {
        this.llm = llm;
        this.gestionPrevisions = gestionPrevisions;
        this.calculateurMarge = calculateurMarge;
        this.documents = documents;
    }

    public String repondre(Long projetId, String message) {
        if (projetId == null) {
            throw new DonneesInvalides("projetId est obligatoire");
        }
        if (message == null || message.isBlank()) {
            throw new DonneesInvalides("message est obligatoire");
        }
        if (message.length() > MESSAGE_LONGUEUR_MAX) {
            throw new DonneesInvalides("message ne doit pas dépasser " + MESSAGE_LONGUEUR_MAX + " caractères");
        }
        return llm.converser(CONSIGNES, message,
                new OutilsFinanciers(projetId, gestionPrevisions, calculateurMarge, documents));
    }
}
