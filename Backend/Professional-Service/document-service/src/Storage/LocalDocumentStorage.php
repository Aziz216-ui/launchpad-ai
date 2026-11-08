<?php

namespace App\Storage;

use Symfony\Component\Filesystem\Filesystem;
use Symfony\Component\Uid\Uuid;

/**
 * Stockage sur disque local (par défaut var/uploads), hors du dossier public/.
 * Les clés sont générées par le service : jamais de nom fourni par le client.
 */
final class LocalDocumentStorage implements DocumentStorageInterface
{
    private const KEY_PATTERN = '#^[a-z0-9-]+/[a-z0-9-]+\.[a-z0-9]{1,10}$#';

    private readonly Filesystem $filesystem;

    public function __construct(private readonly string $storageDirectory)
    {
        $this->filesystem = new Filesystem();
    }

    public function store(\SplFileInfo $source, string $directory, string $extension): string
    {
        $key = sprintf('%s/%s.%s', strtolower($directory), Uuid::v7()->toRfc4122(), strtolower($extension));
        $this->assertValidKey($key);

        $this->filesystem->copy($source->getPathname(), $this->path($key));

        return $key;
    }

    public function readStream(string $key)
    {
        if (!$this->exists($key)) {
            throw new StorageException(sprintf('Stored file "%s" not found.', $key));
        }

        $stream = fopen($this->path($key), 'r');
        if (false === $stream) {
            throw new StorageException(sprintf('Unable to open stored file "%s".', $key));
        }

        return $stream;
    }

    public function exists(string $key): bool
    {
        $this->assertValidKey($key);

        return is_file($this->path($key));
    }

    private function path(string $key): string
    {
        return rtrim($this->storageDirectory, '/\\').'/'.$key;
    }

    /** Empêche toute sortie du répertoire de stockage (../, chemins absolus). */
    private function assertValidKey(string $key): void
    {
        if (!preg_match(self::KEY_PATTERN, $key)) {
            throw new StorageException(sprintf('Invalid storage key "%s".', $key));
        }
    }
}
