<?php

namespace App\Storage;

/**
 * Stockage privé des fichiers déposés. Implémentation locale aujourd'hui,
 * remplaçable par S3 / MinIO sans toucher au reste du code.
 */
interface DocumentStorageInterface
{
    /**
     * Copie le fichier source dans le stockage et renvoie sa clé.
     *
     * @param string $directory sous-dossier logique (ex. identifiant du dossier client)
     * @param string $extension extension normalisée (pdf, png, jpg, xlsx)
     */
    public function store(\SplFileInfo $source, string $directory, string $extension): string;

    /**
     * @return resource flux en lecture du fichier
     *
     * @throws StorageException si la clé est inconnue ou invalide
     */
    public function readStream(string $key);

    public function exists(string $key): bool;
}
