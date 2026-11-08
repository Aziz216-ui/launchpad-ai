<?php

namespace App\Remote;

/**
 * Lecture des documents auprès de document-service.
 */
interface DocumentDirectory
{
    public function find(string $documentId): ?DocumentRef;
}
