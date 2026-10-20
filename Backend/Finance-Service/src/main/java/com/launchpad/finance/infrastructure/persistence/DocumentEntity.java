package com.launchpad.finance.infrastructure.persistence;

import com.launchpad.finance.domain.model.ContenuDocument;
import com.launchpad.finance.domain.model.TypeDocument;
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

    DocumentEntity(UUID id, UUID projetId, TypeDocument type, ContenuDocument contenu, Instant createdAt) {
        this.id = id;
        this.projetId = projetId;
        this.type = type;
        this.contenu = contenu;
        this.createdAt = createdAt;
    }

    UUID getId() {
        return id;
    }

    UUID getProjetId() {
        return projetId;
    }

    TypeDocument getType() {
        return type;
    }

    ContenuDocument getContenu() {
        return contenu;
    }

    Instant getCreatedAt() {
        return createdAt;
    }
}
