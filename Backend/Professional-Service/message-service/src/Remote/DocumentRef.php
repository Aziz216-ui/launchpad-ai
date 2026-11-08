<?php

namespace App\Remote;

/**
 * Document tel que renvoyé par document-service (GET /internal/documents/{id}).
 */
final class DocumentRef
{
    public function __construct(
        public readonly string $id,
        public readonly string $clientFileId,
        public readonly bool $deleted,
    ) {
    }

    /**
     * @param array<string, mixed> $data
     */
    public static function fromArray(array $data): self
    {
        return new self((string) $data['id'], (string) $data['clientFileId'], (bool) $data['deleted']);
    }
}
