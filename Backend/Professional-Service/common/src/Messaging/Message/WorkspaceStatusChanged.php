<?php

namespace Launchpad\Common\Messaging\Message;

/**
 * Publié par workspace-service quand un administrateur active ou désactive un espace comptable.
 * Consommé par client-file-service : ses dossiers suivent l'état de l'espace et, à la désactivation,
 * les demandes en attente sont refusées avec $reason.
 */
final class WorkspaceStatusChanged implements QueueMessage
{
    public function __construct(
        public readonly string $workspaceId,
        public readonly bool $active,
        public readonly string $reason,
        public readonly string $changedBy,
        public readonly string $changedAt,
    ) {
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            workspaceId: (string) $data['workspaceId'],
            active: (bool) $data['active'],
            reason: (string) $data['reason'],
            changedBy: (string) ($data['changedBy'] ?? ''),
            changedAt: (string) ($data['changedAt'] ?? ''),
        );
    }

    public function toArray(): array
    {
        return [
            'workspaceId' => $this->workspaceId,
            'active' => $this->active,
            'reason' => $this->reason,
            'changedBy' => $this->changedBy,
            'changedAt' => $this->changedAt,
        ];
    }
}
