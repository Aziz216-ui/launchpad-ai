<?php

namespace App\Tests\Double;

use App\Remote\DocumentDirectory;
use App\Remote\DocumentRef;
use Launchpad\Common\Fixtures\FixtureCatalog;

/**
 * Doublure de document-service : les documents du catalogue des fixtures.
 */
final class FakeDocumentDirectory implements DocumentDirectory
{
    public function find(string $documentId): ?DocumentRef
    {
        $document = FixtureCatalog::DOCUMENTS[$documentId] ?? null;

        return null !== $document ? new DocumentRef($documentId, $document['clientFileId'], $document['deleted']) : null;
    }
}
