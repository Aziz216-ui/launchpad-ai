<?php

namespace App\Tests\Functional;

use App\Entity\AccountingDocument;
use App\Repository\AccountingDocumentRepository;
use Launchpad\Common\Fixtures\FixtureCatalog;
use Launchpad\Common\Testing\ApiTestCase as BaseApiTestCase;
use Launchpad\Common\Testing\FakeClientFileDirectory;
use Launchpad\Common\Testing\FakeMessagePublisher;

abstract class ApiTestCase extends BaseApiTestCase
{
    /** Dossier des fixtures (servi par la doublure de client-file-service). */
    protected function fileId(string $reference): string
    {
        return FixtureCatalog::fileIdByReference($reference);
    }

    protected function documentId(string $title): string
    {
        /** @var AccountingDocument|null $document */
        $document = static::getContainer()->get(AccountingDocumentRepository::class)->findOneBy(['title' => $title]);

        return $document?->getId()->toRfc4122() ?? self::fail("Document « $title » absent des fixtures.");
    }

    /** Doublure de client-file-service, modifiable par le test. */
    protected function clientFiles(): FakeClientFileDirectory
    {
        return static::getContainer()->get(FakeClientFileDirectory::class);
    }

    /** Doublure de RabbitMQ : messages publiés pendant le test. */
    protected function rabbitMq(): FakeMessagePublisher
    {
        return static::getContainer()->get(FakeMessagePublisher::class);
    }
}
