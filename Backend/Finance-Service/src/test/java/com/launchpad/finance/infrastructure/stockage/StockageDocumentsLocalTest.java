package com.launchpad.finance.infrastructure.stockage;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class StockageDocumentsLocalTest {

    @TempDir
    Path racine;

    @Test
    void enregistre_remplace_puis_supprime_un_fichier() throws IOException {
        StockageDocumentsLocal stockage = new StockageDocumentsLocal(racine.resolve("documents"));

        stockage.enregistrer("doc.pdf", new byte[]{1, 2, 3}, "application/pdf");
        stockage.enregistrer("doc.pdf", new byte[]{9}, "application/pdf");
        assertThat(Files.readAllBytes(racine.resolve("documents/doc.pdf"))).containsExactly(9);

        stockage.supprimer("doc.pdf");
        assertThat(racine.resolve("documents/doc.pdf")).doesNotExist();
        try (var restants = Files.list(racine.resolve("documents"))) {
            assertThat(restants).isEmpty();
        }
    }

    @Test
    void supprimer_un_fichier_absent_est_sans_effet() {
        StockageDocumentsLocal stockage = new StockageDocumentsLocal(racine);

        assertThatCode(() -> stockage.supprimer("absent.xlsx")).doesNotThrowAnyException();
    }

    @Test
    void refuse_une_cle_qui_sort_du_repertoire() {
        StockageDocumentsLocal stockage = new StockageDocumentsLocal(racine.resolve("documents"));

        assertThatThrownBy(() -> stockage.enregistrer("../evasion.pdf", new byte[]{1}, "application/pdf"))
                .isInstanceOf(StockageException.class);
        assertThat(racine.resolve("evasion.pdf")).doesNotExist();
    }
}
