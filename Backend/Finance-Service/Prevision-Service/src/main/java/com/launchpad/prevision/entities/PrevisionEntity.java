package com.launchpad.prevision.entities;

import com.launchpad.prevision.domain.StatutValidation;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "prevision")
public class PrevisionEntity extends AuditedEntity {

    @Column(name = "projet_id", nullable = false, updatable = false)
    private Long projetId;

    @Column(nullable = false, length = 50)
    private String periode;

    @Column(name = "chiffre_affaires", nullable = false, precision = 15, scale = 2)
    private BigDecimal chiffreAffaires;

    @Column(name = "couts_directs", nullable = false, precision = 15, scale = 2)
    private BigDecimal coutsDirects;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal depenses;

    @Enumerated(EnumType.STRING)
    @Column(name = "statut_validation", nullable = false, length = 20)
    private StatutValidation statutValidation = StatutValidation.EN_ATTENTE;

    @Column(name = "commentaire_validation", length = 2000)
    private String commentaireValidation;

    @Column(name = "valide_par", length = 320)
    private String validePar;

    @Column(name = "valide_le")
    private Instant valideLe;

    protected PrevisionEntity() {
    }

    public PrevisionEntity(UUID id, Long projetId, String periode, BigDecimal chiffreAffaires, BigDecimal coutsDirects,
                           BigDecimal depenses, Instant createdAt) {
        super(id, createdAt);
        this.projetId = projetId;
        this.periode = periode;
        this.chiffreAffaires = chiffreAffaires;
        this.coutsDirects = coutsDirects;
        this.depenses = depenses;
    }

    public Long getProjetId() {
        return projetId;
    }

    public String getPeriode() {
        return periode;
    }

    public BigDecimal getChiffreAffaires() {
        return chiffreAffaires;
    }

    public BigDecimal getCoutsDirects() {
        return coutsDirects;
    }

    public BigDecimal getDepenses() {
        return depenses;
    }

    public StatutValidation getStatutValidation() {
        return statutValidation;
    }

    public String getCommentaireValidation() {
        return commentaireValidation;
    }

    public String getValidePar() {
        return validePar;
    }

    public Instant getValideLe() {
        return valideLe;
    }

    /** Enregistre l'avis du financier (ou le remet EN_ATTENTE). */
    public void appliquerValidation(StatutValidation statut, String commentaire, String auteur, Instant le) {
        this.statutValidation = statut;
        this.commentaireValidation = commentaire;
        this.validePar = auteur;
        this.valideLe = le;
    }
}
