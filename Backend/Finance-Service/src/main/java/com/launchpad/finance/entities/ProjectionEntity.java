package com.launchpad.finance.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Projection rattachée à sa prévision par prevision_id (sans association JPA :
 * le remplacement des projections se fait par requêtes explicites).
 */
@Entity
@Table(name = "projection")
public class ProjectionEntity {

    @Id
    private UUID id;

    @Column(name = "prevision_id", nullable = false)
    private UUID previsionId;

    @Column(nullable = false)
    private int annee;

    @Column(name = "chiffre_affaires", nullable = false, precision = 15, scale = 2)
    private BigDecimal chiffreAffaires;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal depenses;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal marge;

    protected ProjectionEntity() {
    }

    public ProjectionEntity(UUID id, UUID previsionId, int annee, BigDecimal chiffreAffaires, BigDecimal depenses,
                     BigDecimal marge) {
        this.id = id;
        this.previsionId = previsionId;
        this.annee = annee;
        this.chiffreAffaires = chiffreAffaires;
        this.depenses = depenses;
        this.marge = marge;
    }

    public UUID getPrevisionId() {
        return previsionId;
    }

    public int getAnnee() {
        return annee;
    }

    public BigDecimal getChiffreAffaires() {
        return chiffreAffaires;
    }

    public BigDecimal getDepenses() {
        return depenses;
    }

    public BigDecimal getMarge() {
        return marge;
    }
}
