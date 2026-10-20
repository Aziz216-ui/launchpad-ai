package com.launchpad.finance.config;

import com.launchpad.finance.service.stockage.StockageDocuments;
import com.launchpad.finance.service.stockage.StockageDocumentsLocal;
import com.launchpad.finance.service.stockage.StockageDocumentsObjet;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

import java.net.URI;
import java.nio.file.Path;

/**
 * Choix de l'adaptateur de stockage selon le profil : disque en dev, stockage objet sinon.
 */
@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(StockageObjetProperties.class)
public class StockageConfig {

    @Bean
    @Profile("dev")
    StockageDocuments stockageDocumentsLocal(@Value("${finance.stockage.local.repertoire}") Path repertoire) {
        return new StockageDocumentsLocal(repertoire);
    }

    @Bean
    @Profile("!dev")
    StockageDocuments stockageDocumentsObjet(StockageObjetProperties proprietes) {
        return new StockageDocumentsObjet(clientS3(proprietes), proprietes.bucket());
    }

    /** Client S3 configuré pour MinIO : endpoint explicite, adressage par chemin, sommes de contrôle à la demande. */
    public static S3Client clientS3(StockageObjetProperties p) {
        return S3Client.builder()
                .endpointOverride(URI.create(p.endpoint()))
                .region(Region.of(p.region()))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(p.accessKey(), p.secretKey())))
                .forcePathStyle(true)
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
                .build();
    }
}
