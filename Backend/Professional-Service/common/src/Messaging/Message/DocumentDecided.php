<?php

namespace Launchpad\Common\Messaging\Message;

/**
 * Publié par document-service quand le comptable valide ou rejette un document.
 * Consommé par message-service, qui en informe l'entrepreneur dans le fil du dossier.
 */
final class DocumentDecided implements QueueMessage
{
    public const VALIDATED = 'VALIDATED';
    public const REJECTED = 'REJECTED';

    public function __construct(
        public readonly string $documentId,
        public readonly string $clientFileId,
        public readonly string $title,
        public readonly int $versionNumber,
        public readonly string $decision,
        public readonly ?string $comment,
        public readonly bool $revision,
        public readonly string $accountantId,
        public readonly string $decidedAt,
    ) {
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): self
    {
        return new self(
            documentId: (string) $data['documentId'],
            clientFileId: (string) $data['clientFileId'],
            title: (string) $data['title'],
            versionNumber: (int) ($data['versionNumber'] ?? 1),
            decision: (string) $data['decision'],
            comment: isset($data['comment']) ? (string) $data['comment'] : null,
            revision: (bool) ($data['revision'] ?? false),
            accountantId: (string) $data['accountantId'],
            decidedAt: (string) ($data['decidedAt'] ?? ''),
        );
    }

    public function toArray(): array
    {
        return [
            'documentId' => $this->documentId,
            'clientFileId' => $this->clientFileId,
            'title' => $this->title,
            'versionNumber' => $this->versionNumber,
            'decision' => $this->decision,
            'comment' => $this->comment,
            'revision' => $this->revision,
            'accountantId' => $this->accountantId,
            'decidedAt' => $this->decidedAt,
        ];
    }
}
