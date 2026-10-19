package com.launchpad.finance.infrastructure.persistence;

import com.launchpad.finance.TestcontainersConfiguration;
import com.launchpad.finance.domain.model.PrevisionFinanciere;
import com.launchpad.finance.domain.model.ProjectionFinanciere;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TestcontainersConfiguration.class, PrevisionRepositoryJpa.class})
class PrevisionRepositoryJpaTest {

    @Autowired
    private PrevisionRepositoryJpa repository;

    @Autowired
    private EntityManager entityManager;

    private final UUID projetId = UUID.randomUUID();

    private PrevisionFinanciere prevision(String periode, Instant creeLe) {
        return new PrevisionFinanciere(UUID.randomUUID(), projetId, periode, new BigDecimal("100000.50"),
                new BigDecimal("40000"), new BigDecimal("70000"), creeLe, List.of());
    }

    private static ProjectionFinanciere projection(int annee, String ca, String depenses) {
        return ProjectionFinanciere.de(annee, new BigDecimal(ca), new BigDecimal(depenses));
    }

    private void viderContexte() {
        entityManager.flush();
        entityManager.clear();
    }

    @Test
    void sauvegarde_et_relit_une_prevision_a_l_identique() {
        PrevisionFinanciere prevision = prevision("2026", Instant.now().truncatedTo(ChronoUnit.MICROS));
        repository.save(prevision);
        viderContexte();

        assertThat(repository.findById(prevision.id())).contains(prevision);
    }

    @Test
    void liste_les_previsions_d_un_projet_de_la_plus_recente_a_la_plus_ancienne() {
        Instant t0 = Instant.parse("2026-01-01T00:00:00Z");
        PrevisionFinanciere ancienne = prevision("2025", t0);
        PrevisionFinanciere recente = prevision("2026", t0.plusSeconds(60))
                .avecProjections(List.of(projection(1, "110", "70")));
        repository.save(ancienne);
        repository.save(recente);
        repository.save(new PrevisionFinanciere(UUID.randomUUID(), UUID.randomUUID(), "autre projet",
                BigDecimal.ONE, BigDecimal.ZERO, BigDecimal.ONE, t0.plusSeconds(120), List.of()));
        viderContexte();

        assertThat(repository.findByProjetId(projetId)).extracting(PrevisionFinanciere::id)
                .containsExactly(recente.id(), ancienne.id());
        assertThat(repository.findByProjetId(projetId).get(0).projections()).hasSize(1);
        assertThat(repository.findLatestByProjetId(projetId)).map(PrevisionFinanciere::id).contains(recente.id());
        assertThat(repository.findByProjetId(UUID.randomUUID())).isEmpty();
        assertThat(repository.findLatestByProjetId(UUID.randomUUID())).isEmpty();
    }

    @Test
    void replace_projections_remplace_les_anciennes_sans_violer_l_unicite_par_annee() {
        PrevisionFinanciere prevision = prevision("2026", Instant.now().truncatedTo(ChronoUnit.MICROS));
        repository.save(prevision);
        repository.replaceProjections(prevision.id(), List.of(
                projection(1, "110", "70"), projection(2, "121", "75"), projection(3, "133", "80")));
        viderContexte();

        List<ProjectionFinanciere> nouvelles = List.of(projection(1, "200", "100"), projection(2, "250", "120"));
        repository.replaceProjections(prevision.id(), nouvelles);
        viderContexte();

        assertThat(repository.findById(prevision.id()).orElseThrow().projections()).isEqualTo(nouvelles);
    }
}
