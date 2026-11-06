package com.launchpad.document.entities;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.Version;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * Entité racine d'agrégat : verrouillage optimiste (version) et dates d'audit.
 * <p>
 * {@code version} reste null tant que l'entité n'est pas persistée : Spring Data la considère alors comme
 * nouvelle et fait un INSERT direct, sans SELECT préalable (l'identifiant étant assigné par le domaine).
 */
@MappedSuperclass
public abstract class AuditedEntity extends BaseEntity {

    @Version
    @Column(nullable = false)
    private Long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected AuditedEntity() {
    }

    protected AuditedEntity(UUID id, Instant createdAt) {
        super(id);
        this.createdAt = createdAt;
    }

    public Long getVersion() {
        return version;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
