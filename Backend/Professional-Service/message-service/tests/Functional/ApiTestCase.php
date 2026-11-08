<?php

namespace App\Tests\Functional;

use Launchpad\Common\Fixtures\FixtureCatalog;
use Launchpad\Common\Testing\ApiTestCase as BaseApiTestCase;
use Launchpad\Common\Testing\FakeClientFileDirectory;

abstract class ApiTestCase extends BaseApiTestCase
{
    /** Dossier des fixtures (servi par la doublure de client-file-service). */
    protected function fileId(string $reference): string
    {
        return FixtureCatalog::fileIdByReference($reference);
    }

    /** Document des fixtures (servi par la doublure de document-service). */
    protected function documentId(string $title): string
    {
        foreach (FixtureCatalog::DOCUMENTS as $id => $document) {
            if ($document['title'] === $title) {
                return $id;
            }
        }

        self::fail("Document « $title » absent du catalogue.");
    }

    protected function clientFiles(): FakeClientFileDirectory
    {
        return static::getContainer()->get(FakeClientFileDirectory::class);
    }
}
