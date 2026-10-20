package com.launchpad.finance.infrastructure.stockage;

import com.launchpad.finance.domain.port.StockageDocuments;
import software.amazon.awssdk.core.exception.SdkException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;

/**
 * Patron Adapter : implémente IDocuments (port StockageDocuments) sur un stockage objet compatible S3 (MinIO…).
 * Le bucket est créé au premier enregistrement s'il n'existe pas.
 */
public class StockageDocumentsObjet implements StockageDocuments {

    private final S3Client s3;
    private final String bucket;

    public StockageDocumentsObjet(S3Client s3, String bucket) {
        this.s3 = s3;
        this.bucket = bucket;
    }

    @Override
    public void enregistrer(String cle, byte[] contenu, String typeContenu) {
        try {
            try {
                deposer(cle, contenu, typeContenu);
            } catch (NoSuchBucketException e) {
                s3.createBucket(b -> b.bucket(bucket));
                deposer(cle, contenu, typeContenu);
            }
        } catch (SdkException e) {
            throw new StockageException("Échec de l'enregistrement de " + cle + " dans le bucket " + bucket, e);
        }
    }

    @Override
    public void supprimer(String cle) {
        try {
            s3.deleteObject(b -> b.bucket(bucket).key(cle));
        } catch (NoSuchBucketException e) {
            // Rien à supprimer.
        } catch (SdkException e) {
            throw new StockageException("Échec de la suppression de " + cle + " dans le bucket " + bucket, e);
        }
    }

    private void deposer(String cle, byte[] contenu, String typeContenu) {
        s3.putObject(b -> b.bucket(bucket).key(cle).contentType(typeContenu), RequestBody.fromBytes(contenu));
    }
}
