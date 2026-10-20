package com.launchpad.finance.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "prevision")
public class PrevisionEntity {

    @Id
    private UUID id;

    @Column(name = "projet_id", nullable = false)
    private UUID projetId;

    @Column(nullable = false, length = 50)
    private String periode;

    @Column(name = "chiffre_affaires", nullable = false, precision = 15, scale = 2)
    private BigDecimal chiffreAffaires;

    @Column(name = "couts_directs", nullable = false, precision = 15, scale = 2)
    private BigDecimal coutsDirects;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal depenses;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected PrevisionEntity() {
    }

    public PrevisionEntity(UUID id, UUID projetId, String periode, BigDecimal chiffreAffaires, BigDecimal coutsDirects,
                    BigDecimal depenses, Instant createdAt) {
        this.id = id;
        this.projetId = projetId;
        this.periode = periode;
        this.chiffreAffaires = chiffreAffaires;
        this.coutsDirects = coutsDirects;
        this.depenses = depenses;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
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

    public Instant getCreatedAt() {
        return createdAt;
    }
}
