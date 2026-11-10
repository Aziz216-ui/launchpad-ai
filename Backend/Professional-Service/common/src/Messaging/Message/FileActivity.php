<?php

namespace Launchpad\Common\Messaging\Message;

/**
 * Activité sur un dossier, publiée par l'acteur (client-file-service, document-service) et transformée par
 * message-service en message automatique du fil : l'autre participant la voit comme une notification.
 * Le texte est rédigé par le producteur, qui connaît le contexte (nom de la startup, motif, document…).
 */
final class FileActivity implements QueueMessage
{
    public const REQUESTED = 'REQUESTED';
    public const ACCEPTED = 'ACCEPTED';
    public const REJECTED = 'REJECTED';
    public const CLOSED = 'CLOSED';
    public const DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED';

    public function __construct(
        public readonly string $clientFileId,
        public readonly string $activity,
        /** Auteur de l'action : le message lui est attribué, l'autre participant est notifié. */
        public readonly string $actorId,
        /** ACCOUNTANT ou ENTREPRENEUR. */
        public readonly string $actorRole,
        public readonly string $content,
        public readonly ?string $documentId = null,
        public readonly string $occurredAt = '',
    ) {
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): self
    {
        foreach (['clientFileId', 'activity', 'actorId', 'actorRole', 'content'] as $field) {
            if ('' === trim((string) ($data[$field] ?? ''))) {
                throw new \InvalidArgumentException("$field manquant dans le message.");
            }
        }

        return new self(
            clientFileId: (string) $data['clientFileId'],
            activity: (string) $data['activity'],
            actorId: (string) $data['actorId'],
            actorRole: (string) $data['actorRole'],
            content: (string) $data['content'],
            documentId: isset($data['documentId']) && '' !== $data['documentId'] ? (string) $data['documentId'] : null,
            occurredAt: (string) ($data['occurredAt'] ?? ''),
        );
    }

    public function toArray(): array
    {
        return [
            'clientFileId' => $this->clientFileId,
            'activity' => $this->activity,
            'actorId' => $this->actorId,
            'actorRole' => $this->actorRole,
            'content' => $this->content,
            'documentId' => $this->documentId,
            'occurredAt' => $this->occurredAt,
        ];
    }
}
