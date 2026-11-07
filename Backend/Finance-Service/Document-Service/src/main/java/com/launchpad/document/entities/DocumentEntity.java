package com.launchpad.document.entities;

import com.launchpad.document.domain.ContenuDocument;
import com.launchpad.document.domain.TypeDocument;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "document_financier")
public class DocumentEntity extends AuditedEntity {

    @Column(name = "projet_id", nullable = false, updatable = false)
    private UUID projetId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 30)
    private TypeDocument type;

    /** Contenu structuré sérialisé en JSON dans une colonne jsonb. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private ContenuDocument contenu;

    protected DocumentEntity() {
    }

    public DocumentEntity(UUID id, UUID projetId, TypeDocument type, ContenuDocument contenu, Instant createdAt) {
        super(id, createdAt);
        this.projetId = projetId;
        this.type = type;
        this.contenu = contenu;
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
}
