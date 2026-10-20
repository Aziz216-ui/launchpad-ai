package com.launchpad.finance.infrastructure.stockage;

import com.launchpad.finance.domain.port.StockageDocuments;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

/**
 * Patron Adapter : implémente IDocuments (port StockageDocuments) sur le disque local. Profil dev.
 */
public class StockageDocumentsLocal implements StockageDocuments {

    private final Path racine;

    public StockageDocumentsLocal(Path racine) {
        this.racine = racine.toAbsolutePath().normalize();
    }

    @Override
    public void enregistrer(String cle, byte[] contenu, String typeContenu) {
        Path cible = resoudre(cle);
        try {
            Files.createDirectories(cible.getParent());
            Path temporaire = Files.createTempFile(cible.getParent(), ".upload-", ".tmp");
            Files.write(temporaire, contenu);
            Files.move(temporaire, cible, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            throw new StockageException("Échec de l'enregistrement du fichier " + cle, e);
        }
    }

    @Override
    public void supprimer(String cle) {
        try {
            Files.deleteIfExists(resoudre(cle));
        } catch (IOException e) {
            throw new StockageException("Échec de la suppression du fichier " + cle, e);
        }
    }

    /** Refuse toute clé qui sortirait du répertoire racine (ex. "../"). */
    private Path resoudre(String cle) {
        Path chemin = racine.resolve(cle).normalize();
        if (!chemin.startsWith(racine) || chemin.equals(racine)) {
            throw new StockageException("Clé de stockage invalide : " + cle);
        }
        return chemin;
    }
}
