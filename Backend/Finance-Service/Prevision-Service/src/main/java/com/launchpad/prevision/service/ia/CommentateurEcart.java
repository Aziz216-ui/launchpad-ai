package com.launchpad.prevision.service.ia;

import com.launchpad.prevision.domain.EcartFinancier;
import com.launchpad.prevision.domain.Marges;
import com.launchpad.prevision.domain.PrevisionFinanciere;
import com.launchpad.prevision.service.CalculateurMarge;
import com.launchpad.prevision.service.ComparateurRevenusDepenses;
import com.launchpad.prevision.service.GestionPrevisions;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Scénario 1, cas alt (c) : commente l'écart revenus / dépenses en langage clair.
 * Les chiffres sont calculés par le code ; le modèle ne fait que les rédiger.
 */
@Service
public class CommentateurEcart {

    static final String CONSIGNES = """
            Tu es un assistant financier pour un entrepreneur. Rédige en français un commentaire clair \
            de 3 à 5 phrases sur la situation financière décrite. Utilise uniquement les chiffres fournis, \
            sans en inventer ni en recalculer. Termine par un conseil concret.""";

    private final GestionPrevisions gestionPrevisions;
    private final CalculateurMarge calculateurMarge;
    private final ComparateurRevenusDepenses comparateur;
    private final ClientLLM llm;

    public CommentateurEcart(GestionPrevisions gestionPrevisions, CalculateurMarge calculateurMarge,
                             ComparateurRevenusDepenses comparateur, ClientLLM llm) {
        this.gestionPrevisions = gestionPrevisions;
        this.calculateurMarge = calculateurMarge;
        this.comparateur = comparateur;
        this.llm = llm;
    }

    public String commenter(UUID previsionId) {
        PrevisionFinanciere prevision = gestionPrevisions.consulterPrevision(previsionId);
        Marges marges = calculateurMarge.calculerMarges(prevision);
        EcartFinancier ecart = comparateur.comparer(prevision);
        return llm.generer(CONSIGNES, chiffres(prevision, marges, ecart));
    }

    static String chiffres(PrevisionFinanciere p, Marges m, EcartFinancier e) {
        return """
                Période : %s
                Chiffre d'affaires : %s
                Coûts directs : %s
                Dépenses totales : %s
                Marge brute : %s (%s %% du CA)
                Marge nette : %s (%s %% du CA)
                Écart revenus - dépenses : %s (%s %% du CA), statut %s"""
                .formatted(p.periode(), p.chiffreAffaires().toPlainString(), p.coutsDirects().toPlainString(),
                        p.depenses().toPlainString(), m.margeBrute().toPlainString(),
                        m.tauxMargeBrute().toPlainString(), m.margeNette().toPlainString(),
                        m.tauxMargeNette().toPlainString(), e.montant().toPlainString(),
                        e.pourcentage().toPlainString(), e.statut());
    }
}
