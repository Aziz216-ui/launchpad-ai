package com.launchpad.finance.repository;

import com.launchpad.finance.TestcontainersConfiguration;
import com.launchpad.finance.domain.ContenuDocument;
import com.launchpad.finance.domain.DocumentFinancier;
import com.launchpad.finance.domain.LigneDocument;
import com.launchpad.finance.domain.SectionDocument;
import com.launchpad.finance.domain.TypeDocument;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TestcontainersConfiguration.class, DocumentRepositoryJpa.class})
class DocumentRepositoryJpaTest {

    @Autowired
    private DocumentRepositoryJpa repository;

    @Autowired
    private EntityManager entityManager;

    private final UUID projetId = UUID.randomUUID();

    private static final ContenuDocument CONTENU = new ContenuDocument("Plan de trésorerie - période 2026", List.of(
            new SectionDocument("Plan de trésorerie", List.of("Encaissements", "Décaissements"),
                    List.of(LigneDocument.de("Année 1", new BigDecimal("110000.00"), new BigDecimal("-73500.50"))),
                    List.of("Note accentuée : é à ç"))));

    private DocumentFinancier document(TypeDocument type, Instant creeLe) {
        return new DocumentFinancier(UUID.randomUUID(), projetId, type, CONTENU, creeLe);
    }

    private void viderContexte() {
        entityManager.flush();
        entityManager.clear();
    }

    @Test
    void sauvegarde_le_contenu_en_jsonb_et_le_relit_a_l_identique() {
        DocumentFinancier document = document(TypeDocument.PLAN_TRESORERIE, Instant.parse("2026-03-01T10:15:30.123456Z"));
        repository.save(document);
        viderContexte();

        assertThat(repository.findById(document.id())).contains(document);
        Object typeColonne = entityManager.createNativeQuery(
                        "select jsonb_typeof(contenu -> 'sections') from document_financier where id = :id")
                .setParameter("id", document.id()).getSingleResult();
        assertThat(typeColonne).isEqualTo("array");
    }

    @Test
    void liste_par_projet_du_plus_recent_au_plus_ancien_puis_supprime() {
        Instant t0 = Instant.parse("2026-01-01T00:00:00Z");
        DocumentFinancier ancien = document(TypeDocument.BUSINESS_PLAN, t0);
        DocumentFinancier recent = document(TypeDocument.RAPPORT_INVESTISSEUR, t0.plusSeconds(5));
        repository.save(ancien);
        repository.save(recent);
        viderContexte();

        assertThat(repository.findByProjetId(projetId)).extracting(DocumentFinancier::id)
                .containsExactly(recent.id(), ancien.id());

        repository.deleteById(ancien.id());
        viderContexte();

        assertThat(repository.findById(ancien.id())).isEmpty();
        assertThat(repository.findByProjetId(projetId)).hasSize(1);
    }
}
