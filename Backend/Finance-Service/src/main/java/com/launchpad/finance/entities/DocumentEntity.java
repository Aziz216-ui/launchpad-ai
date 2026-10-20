package com.launchpad.finance.entities;

import com.launchpad.finance.domain.ContenuDocument;
import com.launchpad.finance.domain.TypeDocument;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "document_financier")
public class DocumentEntity {

    @Id
    private UUID id;

    @Column(name = "projet_id", nullable = false)
    private UUID projetId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TypeDocument type;

    /** Contenu structuré sérialisé en JSON dans une colonne jsonb. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private ContenuDocument contenu;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected DocumentEntity() {
    }

    public DocumentEntity(UUID id, UUID projetId, TypeDocument type, ContenuDocument contenu, Instant createdAt) {
        this.id = id;
        this.projetId = projetId;
        this.type = type;
        this.contenu = contenu;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getProjetId() {
        return projetId;
    }

    public TypeDocument getType() {
        return type;
    }

    public ContenuDocument getContenu() {
        return contenu;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
