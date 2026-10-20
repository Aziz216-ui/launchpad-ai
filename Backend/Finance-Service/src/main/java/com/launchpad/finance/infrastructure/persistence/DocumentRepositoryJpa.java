package com.launchpad.finance.infrastructure.persistence;

import com.launchpad.finance.domain.model.DocumentFinancier;
import com.launchpad.finance.domain.port.DocumentRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Patron Adapter : adapte le port DocumentRepository du Domaine à Spring Data JPA (contenu en jsonb).
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
                document.creeLe()));
        return document;
    }

    @Override
    public Optional<DocumentFinancier> findById(UUID documentId) {
        return documents.findById(documentId).map(DocumentRepositoryJpa::versDomaine);
    }

    @Override
    public List<DocumentFinancier> findByProjetId(UUID projetId) {
        return documents.findByProjetIdOrderByCreatedAtDesc(projetId).stream()
                .map(DocumentRepositoryJpa::versDomaine)
                .toList();
    }

    @Override
    @Transactional
    public void deleteById(UUID documentId) {
        documents.deleteById(documentId);
    }

    private static DocumentFinancier versDomaine(DocumentEntity e) {
        return new DocumentFinancier(e.getId(), e.getProjetId(), e.getType(), e.getContenu(), e.getCreatedAt());
    }
}
