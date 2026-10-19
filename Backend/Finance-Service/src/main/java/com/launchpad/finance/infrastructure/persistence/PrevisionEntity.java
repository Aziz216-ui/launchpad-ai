package com.launchpad.finance.infrastructure.persistence;

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

    PrevisionEntity(UUID id, UUID projetId, String periode, BigDecimal chiffreAffaires, BigDecimal coutsDirects,
                    BigDecimal depenses, Instant createdAt) {
        this.id = id;
        this.projetId = projetId;
        this.periode = periode;
        this.chiffreAffaires = chiffreAffaires;
        this.coutsDirects = coutsDirects;
        this.depenses = depenses;
        this.createdAt = createdAt;
    }

    UUID getId() {
        return id;
    }

    UUID getProjetId() {
        return projetId;
    }

    String getPeriode() {
        return periode;
    }

    BigDecimal getChiffreAffaires() {
        return chiffreAffaires;
    }

    BigDecimal getCoutsDirects() {
        return coutsDirects;
    }

    BigDecimal getDepenses() {
        return depenses;
    }

    Instant getCreatedAt() {
        return createdAt;
    }
}
