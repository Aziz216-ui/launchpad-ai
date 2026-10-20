package com.launchpad.finance.infrastructure.stockage;

import com.launchpad.finance.infrastructure.config.StockageConfig;
import com.launchpad.finance.infrastructure.config.StockageObjetProperties;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Adaptateur de stockage objet contre un vrai serveur compatible S3 (Adobe S3Mock via Testcontainers).
 */
@Testcontainers
class StockageDocumentsObjetTest {

    private static final String BUCKET = "finance-documents";
    private static final int PORT_HTTP = 9090;

    @Container
    static final GenericContainer<?> S3 = new GenericContainer<>("adobe/s3mock:4.7.0")
            .withExposedPorts(PORT_HTTP)
            .waitingFor(Wait.forHttp("/").forPort(PORT_HTTP));

    private static S3Client s3;

    @BeforeAll
    static void client() {
        String endpoint = "http://" + S3.getHost() + ":" + S3.getMappedPort(PORT_HTTP);
        s3 = StockageConfig.clientS3(new StockageObjetProperties(endpoint, "us-east-1", BUCKET, "test", "test"));
    }

    @AfterAll
    static void fermer() {
        s3.close();
    }

    @Test
    void cree_le_bucket_au_besoin_enregistre_puis_supprime() {
        StockageDocumentsObjet stockage = new StockageDocumentsObjet(s3, BUCKET);

        stockage.enregistrer("doc.xlsx", new byte[]{4, 5, 6}, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

        var objet = s3.getObjectAsBytes(b -> b.bucket(BUCKET).key("doc.xlsx"));
        assertThat(objet.asByteArray()).containsExactly(4, 5, 6);
        assertThat(objet.response().contentType()).startsWith("application/vnd.openxmlformats");

        stockage.supprimer("doc.xlsx");
        assertThatThrownBy(() -> s3.getObject(b -> b.bucket(BUCKET).key("doc.xlsx")))
                .isInstanceOf(NoSuchKeyException.class);
        assertThatCode(() -> stockage.supprimer("doc.xlsx")).doesNotThrowAnyException();
    }

    @Test
    void supprimer_dans_un_bucket_inexistant_est_sans_effet() {
        assertThatCode(() -> new StockageDocumentsObjet(s3, "bucket-absent").supprimer("x.pdf"))
                .doesNotThrowAnyException();
    }
}
