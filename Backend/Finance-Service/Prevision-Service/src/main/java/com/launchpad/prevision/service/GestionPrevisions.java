package com.launchpad.prevision.service;

import com.launchpad.prevision.domain.AvisPrevision;
import com.launchpad.prevision.domain.EcartFinancier;
import com.launchpad.prevision.domain.PrevisionAValider;
import com.launchpad.prevision.domain.HypothesesPrevisionnelles;
import com.launchpad.prevision.domain.Marges;
import com.launchpad.prevision.domain.PrevisionFinanciere;
import com.launchpad.prevision.domain.ProjectionFinanciere;
import com.launchpad.prevision.domain.StatutValidation;
import com.launchpad.prevision.domain.SyntheseFinanciere;
import com.launchpad.prevision.domain.ValidationPrevision;
import com.launchpad.prevision.exception.PrevisionIntrouvable;
import com.launchpad.prevision.repository.PrevisionRepository;
import com.launchpad.prevision.service.acces.ControleAcces;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

/**
 * Cas d'usage des scénarios 1 (prévision, marges, écarts), 2 (projections pluriannuelles) et de l'avis du
 * financier. Chaque cas d'usage vérifie d'abord les droits de l'utilisateur sur le projet (ControleAcces) :
 * le propriétaire écrit, le financier invité lit et donne son avis.
 */
@Service
@Transactional(readOnly = true)
public class GestionPrevisions {

    private final PrevisionRepository previsions;
    private final CalculateurMarge calculateurMarge;
    private final ComparateurRevenusDepenses comparateur;
    private final ModelePrevisionnel modelePrevisionnel;
    private final ControleAcces controle;
    private final ApplicationEventPublisher evenements;

    public GestionPrevisions(PrevisionRepository previsions, CalculateurMarge calculateurMarge,
                             ComparateurRevenusDepenses comparateur, ModelePrevisionnel modelePrevisionnel,
                             ControleAcces controle, ApplicationEventPublisher evenements) {
        this.previsions = previsions;
        this.calculateurMarge = calculateurMarge;
        this.comparateur = comparateur;
        this.modelePrevisionnel = modelePrevisionnel;
        this.controle = controle;
        this.evenements = evenements;
    }

    /**
     * Scénario 1 : valide (par le modèle métier), calcule le résultat et sauvegarde.
     * Sur un projet sans propriétaire, l'entrepreneur qui crée la première prévision en devient propriétaire.
     */
    @Transactional
    public PrevisionFinanciere creerPrevision(Long projetId, String periode, BigDecimal chiffreAffaires,
                                              BigDecimal coutsDirects, BigDecimal depenses) {
        PrevisionFinanciere prevision = PrevisionFinanciere.creer(projetId, periode, chiffreAffaires, coutsDirects,
                depenses);
        controle.exigerEcritureEtReserver(projetId);
        PrevisionFinanciere creee = previsions.save(prevision);
        evenements.publishEvent(PrevisionAValider.de(creee));
        return creee;
    }

    public PrevisionFinanciere consulterPrevision(UUID previsionId) {
        PrevisionFinanciere prevision = charger(previsionId);
        controle.exigerLecture(prevision.projetId());
        return prevision;
    }

    public List<PrevisionFinanciere> listerPrevisions(Long projetId) {
        controle.exigerLecture(projetId);
        return previsions.findByProjetId(projetId);
    }

    /** Prévision la plus récente du projet avec ses marges et son écart : consommée par le Document-Service. */
    public SyntheseFinanciere consulterSynthese(Long projetId) {
        controle.exigerLecture(projetId);
        PrevisionFinanciere prevision = previsions.findLatestByProjetId(projetId)
                .orElseThrow(() -> PrevisionIntrouvable.pourProjet(projetId));
        return new SyntheseFinanciere(prevision, calculateurMarge.calculerMarges(prevision),
                comparateur.comparer(prevision));
    }

    /** Scénario 1, cas alt (a). */
    public Marges consulterMarges(UUID previsionId) {
        return calculateurMarge.calculerMarges(consulterPrevision(previsionId));
    }

    /** Scénario 1, cas alt (b). */
    public EcartFinancier comparerRevenusDepenses(UUID previsionId) {
        return comparateur.comparer(consulterPrevision(previsionId));
    }

    /**
     * Scénario 2 : les nouvelles projections remplacent les anciennes dans la même transaction.
     * Les chiffres changent : un avis déjà donné ne vaut plus, la prévision repasse EN_ATTENTE.
     */
    @Transactional
    public List<ProjectionFinanciere> genererProjections(UUID previsionId, BigDecimal tauxCa, BigDecimal tauxDepenses,
                                                         int horizon) {
        PrevisionFinanciere prevision = charger(previsionId);
        controle.exigerEcriture(prevision.projetId());
        HypothesesPrevisionnelles hypotheses = HypothesesPrevisionnelles.depuis(prevision, tauxCa, tauxDepenses);
        List<ProjectionFinanciere> projections = modelePrevisionnel.genererProjections(hypotheses, horizon);
        previsions.replaceProjections(previsionId, projections);
        if (prevision.validation().statut() != StatutValidation.EN_ATTENTE) {
            previsions.updateValidation(previsionId, ValidationPrevision.EN_ATTENTE);
            evenements.publishEvent(PrevisionAValider.de(prevision));
        }
        return projections;
    }

    public List<ProjectionFinanciere> consulterProjections(UUID previsionId) {
        return consulterPrevision(previsionId).projections();
    }

    /** Le financier invité valide ou rejette la prévision (un rejet doit être motivé). */
    @Transactional
    public PrevisionFinanciere donnerAvis(UUID previsionId, StatutValidation decision, String commentaire) {
        PrevisionFinanciere prevision = charger(previsionId);
        String auteur = controle.exigerValidation(prevision.projetId());
        ValidationPrevision avis = ValidationPrevision.avis(decision, commentaire, auteur,
                Instant.now().truncatedTo(ChronoUnit.MICROS));
        previsions.updateValidation(previsionId, avis);
        evenements.publishEvent(AvisPrevision.de(prevision, avis));
        return prevision.avecValidation(avis);
    }

    private PrevisionFinanciere charger(UUID previsionId) {
        return previsions.findById(previsionId).orElseThrow(() -> new PrevisionIntrouvable(previsionId));
    }
}
