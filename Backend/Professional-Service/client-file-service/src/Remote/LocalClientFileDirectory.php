<?php

namespace App\Remote;

use App\Repository\ClientFileRepository;
use Launchpad\Common\Remote\ClientFileDirectory;
use Launchpad\Common\Remote\Model\FileContext;
use Symfony\Component\Uid\Uuid;

/**
 * ClientFileDirectory côté propriétaire des données : lecture directe en base.
 * Sert la route interne GET /internal/files/{id} appelée par document-service et message-service.
 */
final class LocalClientFileDirectory implements ClientFileDirectory
{
    public function __construct(private readonly ClientFileRepository $files)
    {
    }

    public function context(string $fileId): ?FileContext
    {
        if (!Uuid::isValid($fileId)) {
            return null;
        }

        return $this->files->find($fileId)?->toContext();
    }
}
