package com.launchpad.prevision.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "prevision")
public class PrevisionEntity extends AuditedEntity {

    @Column(name = "projet_id", nullable = false, updatable = false)
    private UUID projetId;

    @Column(nullable = false, length = 50)
    private String periode;

    @Column(name = "chiffre_affaires", nullable = false, precision = 15, scale = 2)
    private BigDecimal chiffreAffaires;

    @Column(name = "couts_directs", nullable = false, precision = 15, scale = 2)
    private BigDecimal coutsDirects;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal depenses;

    protected PrevisionEntity() {
    }

    public PrevisionEntity(UUID id, UUID projetId, String periode, BigDecimal chiffreAffaires, BigDecimal coutsDirects,
                           BigDecimal depenses, Instant createdAt) {
        super(id, createdAt);
        this.projetId = projetId;
        this.periode = periode;
        this.chiffreAffaires = chiffreAffaires;
        this.coutsDirects = coutsDirects;
        this.depenses = depenses;
    }

    public UUID getProjetId() {
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
}
