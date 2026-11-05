package com.launchpad.document.entities;

import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import org.hibernate.Hibernate;

import java.util.Objects;
import java.util.UUID;

/**
 * Socle des entités JPA : identifiant UUID assigné par le domaine, égalité fondée sur cet identifiant
 * (stable entre les états transient, managed et detached, et face aux proxys Hibernate).
 */
@MappedSuperclass
public abstract class BaseEntity {

    @Id
    private UUID id;

    protected BaseEntity() {
    }

    protected BaseEntity(UUID id) {
        this.id = Objects.requireNonNull(id, "id");
    }

    public UUID getId() {
        return id;
    }

    @Override
    public final boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || Hibernate.getClass(this) != Hibernate.getClass(o)) {
            return false;
        }
        return id != null && id.equals(((BaseEntity) o).getId());
    }

    @Override
    public final int hashCode() {
        return Hibernate.getClass(this).hashCode();
    }
}
