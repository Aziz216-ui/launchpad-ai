package com.launchpad.document.client;

import com.launchpad.document.domain.EmpreintePrevision;
import com.launchpad.document.domain.EtatPrevision;
import com.launchpad.document.domain.ProjectionSynthese;
import com.launchpad.document.domain.SynthesePrevision;
import com.launchpad.document.exception.PrevisionIntrouvable;
import com.launchpad.document.exception.ServiceIndisponible;
import com.launchpad.document.service.PrevisionDistante;
import feign.FeignException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Adaptateur du port PrevisionDistante : appelle le Prevision-Service par Feign (GET /api/finance/projets/{id}/synthese).
 * Un service éteint ou lent est signalé par ServiceIndisponible (503) au lieu de bloquer ou de faire planter le service.
 */
@Component
public class PrevisionDistanteFeign implements PrevisionDistante {

    private static final Logger LOG = LoggerFactory.getLogger(PrevisionDistanteFeign.class);

    private final PrevisionFeignClient previsions;

    public PrevisionDistanteFeign(PrevisionFeignClient previsions) {
        this.previsions = previsions;
    }

    @Override
    public SynthesePrevision derniereSynthese(Long projetId) {
        try {
            SyntheseJson json = previsions.synthese(projetId);
            if (json == null || json.prevision() == null || json.marges() == null || json.ecart() == null) {
                throw new ServiceIndisponible("Réponse inattendue du Prevision-Service");
            }
            return json.versDomaine();
        } catch (FeignException e) {
            if (e.status() == 404) {
                throw PrevisionIntrouvable.pourProjet(projetId);
            }
            if (e.status() >= 400 && e.status() < 500) {
                throw new ServiceIndisponible("Prevision-Service a refusé la requête : " + e.status());
            }
            // Le détail (adresse, exception) reste dans les journaux : il n'est pas renvoyé au client.
            LOG.warn("Prevision-Service injoignable ou en erreur (synthèse du projet {})", projetId, e);
            throw new ServiceIndisponible("Le service des prévisions est momentanément indisponible");
        }
    }

    @Override
    public EtatPrevision etat(UUID previsionId) {
        try {
            SyntheseJson.PrevisionJson json = previsions.prevision(previsionId);
            if (json == null || json.validation() == null || json.validation().statut() == null) {
                throw new ServiceIndisponible("Réponse inattendue du Prevision-Service");
            }
            return new EtatPrevision(json.validation().statut(), EmpreintePrevision.de(json.periode(),
                    json.chiffreAffaires(), json.coutsDirects(), json.depenses(), json.projectionsDomaine()));
        } catch (FeignException e) {
            if (e.status() == 404) {
                throw new PrevisionIntrouvable(previsionId);
            }
            if (e.status() >= 400 && e.status() < 500) {
                throw new ServiceIndisponible("Prevision-Service a refusé la requête : " + e.status());
            }
            LOG.warn("Prevision-Service injoignable ou en erreur (prévision {})", previsionId, e);
            throw new ServiceIndisponible("Le service des prévisions est momentanément indisponible");
        }
    }

    /** Forme JSON de SyntheseResponse (Prevision-Service) ; les champs inconnus sont ignorés. */
    public record SyntheseJson(PrevisionJson prevision, MargesJson marges, EcartJson ecart) {

        public record PrevisionJson(UUID previsionId, String periode, BigDecimal chiffreAffaires,
                                    BigDecimal coutsDirects, BigDecimal depenses, BigDecimal resultat,
                                    List<ProjectionJson> projections, ValidationJson validation) {

            List<ProjectionSynthese> projectionsDomaine() {
                return projections == null ? List.of() : projections.stream()
                        .map(p -> new ProjectionSynthese(p.annee(), p.chiffreAffaires(), p.depenses(), p.marge()))
                        .toList();
            }
        }

        public record ValidationJson(String statut) {
        }

        public record ProjectionJson(int annee, BigDecimal chiffreAffaires, BigDecimal depenses, BigDecimal marge) {
        }

        public record MargesJson(BigDecimal margeBrute, BigDecimal margeNette, BigDecimal tauxMargeBrute,
                          BigDecimal tauxMargeNette) {
        }

        public record EcartJson(BigDecimal montant, BigDecimal pourcentage, String statut) {
        }

        SynthesePrevision versDomaine() {
            List<ProjectionSynthese> projections = prevision.projectionsDomaine();
            return new SynthesePrevision(prevision.periode(), prevision.chiffreAffaires(), prevision.coutsDirects(),
                    prevision.depenses(), prevision.resultat(), marges.margeBrute(), marges.margeNette(),
                    marges.tauxMargeBrute(), marges.tauxMargeNette(), ecart.montant(), ecart.pourcentage(),
                    ecart.statut(), projections, prevision.previsionId());
        }
    }
}
