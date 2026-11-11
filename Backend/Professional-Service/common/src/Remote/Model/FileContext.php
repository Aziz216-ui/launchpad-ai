<?php

namespace Launchpad\Common\Remote\Model;

/**
 * Ce qu'un service doit savoir d'un dossier client pour appliquer les droits d'accès,
 * sans accéder à la base de client-file-service (GET /internal/files/{id}).
 */
final class FileContext
{
    public const PENDING = 'PENDING';
    public const ACTIVE = 'ACTIVE';

    public function __construct(
        public readonly string $id,
        public readonly string $reference,
        public readonly string $status,
        public readonly string $entrepreneurId,
        public readonly string $accountantId,
        /** L'espace du comptable affecté est-il actif ? (sinon : lecture seule) */
        public readonly bool $workspaceActive,
        /** Nom de la startup : affichage seulement (notifications), jamais utilisé pour les droits. */
        public readonly string $startupName = '',
    ) {
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            id: (string) $data['id'],
            reference: (string) $data['reference'],
            status: (string) $data['status'],
            entrepreneurId: (string) $data['entrepreneurId'],
            accountantId: (string) $data['accountantId'],
            workspaceActive: (bool) $data['workspaceActive'],
            startupName: (string) ($data['startupName'] ?? ''),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'status' => $this->status,
            'entrepreneurId' => $this->entrepreneurId,
            'accountantId' => $this->accountantId,
            'workspaceActive' => $this->workspaceActive,
            'startupName' => $this->startupName,
        ];
    }

    public function isActive(): bool
    {
        return self::ACTIVE === $this->status;
    }

    /** Demande en attente ou dossier actif : les échanges sont ouverts. */
    public function isOpen(): bool
    {
        return self::PENDING === $this->status || self::ACTIVE === $this->status;
    }
}
