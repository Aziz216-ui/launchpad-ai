<?php

namespace App\Remote;

/**
 * Espace comptable tel que renvoyé par workspace-service (GET /internal/workspaces/{id}).
 */
final class WorkspaceInfo
{
    public function __construct(
        public readonly string $id,
        public readonly string $accountantId,
        public readonly string $displayName,
        public readonly bool $acceptingClients,
        public readonly bool $active,
    ) {
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            id: (string) $data['id'],
            accountantId: (string) $data['accountantId'],
            displayName: (string) $data['displayName'],
            acceptingClients: (bool) $data['acceptingClients'],
            active: (bool) $data['active'],
        );
    }

    /** Visible dans l'annuaire proposé aux entrepreneurs. */
    public function isAvailable(): bool
    {
        return $this->active && $this->acceptingClients;
    }
}
