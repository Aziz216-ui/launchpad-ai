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

    public function participantFiles(string $userId, bool $accountant): array
    {
        $query = $accountant
            ? $this->files->createFilteredQuery(accountantId: $userId)
            : $this->files->createFilteredQuery(entrepreneurId: $userId);

        return array_map(static fn ($file): FileContext => $file->toContext(), $query->setMaxResults(500)->getQuery()->getResult());
    }
}
