package com.launchpad.prevision.service.acces;

import com.launchpad.prevision.domain.MembreProjet;
import com.launchpad.prevision.domain.ProjetAccessible;
import com.launchpad.prevision.domain.RoleProjet;
import com.launchpad.prevision.domain.StatutValidation;
import com.launchpad.prevision.domain.Utilisateur;
import com.launchpad.prevision.exception.DonneesInvalides;
import com.launchpad.prevision.exception.MembreIntrouvable;
import com.launchpad.prevision.repository.MembreProjetRepository;
import com.launchpad.prevision.repository.PrevisionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * L'entrepreneur invite et retire des financiers sur son projet ; chacun retrouve ses projets (« mes projets »).
 */
@Service
@Transactional(readOnly = true)
public class GestionEquipe {

    private final MembreProjetRepository membres;
    private final PrevisionRepository previsions;
    private final ControleAcces controle;
    private final UtilisateurCourant courant;

    public GestionEquipe(MembreProjetRepository membres, PrevisionRepository previsions, ControleAcces controle,
                         UtilisateurCourant courant) {
        this.membres = membres;
        this.previsions = previsions;
        this.controle = controle;
        this.courant = courant;
    }

    /** Invite un financier par e-mail. Réinviter le même e-mail renvoie l'invitation existante. */
    @Transactional
    public MembreProjet inviterFinancier(Long projetId, String email) {
        controle.exigerEcritureEtReserver(projetId);
        String normalise = Utilisateur.normaliserEmail(email);
        Optional<MembreProjet> proprietaire = membres.findProprietaire(projetId);
        if (normalise != null && proprietaire.isPresent() && normalise.equals(proprietaire.get().email())) {
            throw new DonneesInvalides("Le propriétaire du projet ne peut pas s'inviter comme financier");
        }
        MembreProjet invitation = MembreProjet.financier(projetId, normalise);
        return membres.findFinancier(projetId, invitation.email()).orElseGet(() -> membres.save(invitation));
    }

    public List<MembreProjet> listerFinanciers(Long projetId) {
        controle.exigerLecture(projetId);
        return membres.findFinanciers(projetId);
    }

    @Transactional
    public void retirerFinancier(Long projetId, String email) {
        controle.exigerEcriture(projetId);
        String normalise = Utilisateur.normaliserEmail(email);
        MembreProjet financier = membres.findFinancier(projetId, normalise)
                .orElseThrow(() -> new MembreIntrouvable(projetId, normalise));
        membres.delete(financier);
    }

    /**
     * Projets de l'utilisateur courant : ceux qu'il possède, puis ceux où il est invité comme financier.
     * Vide sans utilisateur authentifié.
     */
    public List<ProjetAccessible> mesProjets() {
        Optional<Utilisateur> utilisateur = courant.utilisateur();
        if (utilisateur.isEmpty()) {
            return List.of();
        }
        Utilisateur u = utilisateur.get();
        Map<Long, ProjetAccessible> projets = new LinkedHashMap<>();
        for (MembreProjet m : membres.findProprietesDe(u.id())) {
            projets.putIfAbsent(m.projetId(), accessible(m, RoleProjet.PROPRIETAIRE));
        }
        if (u.estFinancier() && u.email() != null) {
            for (MembreProjet m : membres.findInvitationsDe(u.email())) {
                projets.putIfAbsent(m.projetId(), accessible(m, RoleProjet.FINANCIER));
            }
        }
        return new ArrayList<>(projets.values());
    }

    private ProjetAccessible accessible(MembreProjet m, RoleProjet role) {
        return new ProjetAccessible(m.projetId(), role, m.ajouteLe(),
                previsions.countByProjetIdAndStatut(m.projetId(), StatutValidation.EN_ATTENTE));
    }
}
