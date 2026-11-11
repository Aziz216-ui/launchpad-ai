package com.launchpad.prevision.entities;

import com.launchpad.prevision.domain.RoleProjet;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "membre_projet")
public class MembreProjetEntity extends AuditedEntity {

    @Column(name = "projet_id", nullable = false, updatable = false)
    private Long projetId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, updatable = false, length = 20)
    private RoleProjet role;

    @Column(name = "utilisateur_id", length = 255)
    private String utilisateurId;

    @Column(length = 320)
    private String email;

    protected MembreProjetEntity() {
    }

    public MembreProjetEntity(UUID id, Long projetId, RoleProjet role, String utilisateurId, String email,
                              Instant createdAt) {
        super(id, createdAt);
        this.projetId = projetId;
        this.role = role;
        this.utilisateurId = utilisateurId;
        this.email = email;
    }

    public Long getProjetId() {
        return projetId;
    }

    public RoleProjet getRole() {
        return role;
    }

    public String getUtilisateurId() {
        return utilisateurId;
    }

    public String getEmail() {
        return email;
    }
}
