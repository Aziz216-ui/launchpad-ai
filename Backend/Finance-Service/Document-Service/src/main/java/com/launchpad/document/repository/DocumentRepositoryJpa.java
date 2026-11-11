package com.launchpad.document.repository;

import com.launchpad.document.domain.Certification;
import com.launchpad.document.domain.DocumentFinancier;
import com.launchpad.document.entities.DocumentEntity;
import com.launchpad.document.exception.DocumentIntrouvable;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Patron Adapter : adapte le port DocumentRepository à Spring Data JPA (contenu en jsonb).
 */
@Repository
@Transactional(readOnly = true)
public class DocumentRepositoryJpa implements DocumentRepository {

    private final DocumentJpaRepository documents;

    public DocumentRepositoryJpa(DocumentJpaRepository documents) {
        this.documents = documents;
    }

    @Override
    @Transactional
    public DocumentFinancier save(DocumentFinancier document) {
        documents.save(new DocumentEntity(document.id(), document.projetId(), document.type(), document.contenu(),
                document.creeLe(), document.previsionId(), document.empreintePrevision()));
        return document;
    }

    @Override
    public Optional<DocumentFinancier> findById(UUID documentId) {
        return documents.findById(documentId).map(DocumentRepositoryJpa::versDomaine);
    }

    @Override
    public List<DocumentFinancier> findByProjetId(Long projetId) {
        return documents.findByProjetIdOrderByCreatedAtDesc(projetId).stream()
                .map(DocumentRepositoryJpa::versDomaine)
                .toList();
    }

    @Override
    @Transactional
    public void deleteById(UUID documentId) {
        documents.deleteById(documentId);
    }

    @Override
    @Transactional
    public void updateCertification(UUID documentId, Certification c) {
        documents.findById(documentId).orElseThrow(() -> new DocumentIntrouvable(documentId))
                .certifier(c.auteur(), c.commentaire(), c.le());
    }

    private static DocumentFinancier versDomaine(DocumentEntity e) {
        Certification certification = e.getCertifiePar() == null ? null
                : new Certification(e.getCertifiePar(), e.getCommentaireCertification(), e.getCertifieLe());
        return new DocumentFinancier(e.getId(), e.getProjetId(), e.getType(), e.getContenu(), e.getCreatedAt(),
                e.getPrevisionId(), e.getEmpreintePrevision(), certification);
    }
}
