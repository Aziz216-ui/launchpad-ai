<?php

namespace App\Tests\Functional;

use App\Entity\ClientFile;
use App\Repository\ClientFileRepository;
use Launchpad\Common\Fixtures\FixtureCatalog;
use Launchpad\Common\Testing\ApiTestCase as BaseApiTestCase;

abstract class ApiTestCase extends BaseApiTestCase
{
    /** Espace d'un comptable des fixtures (servi par la doublure de workspace-service). */
    protected function workspaceId(string $accountantId): string
    {
        foreach (FixtureCatalog::WORKSPACES as $id => $workspace) {
            if ($workspace['accountantId'] === $accountantId) {
                return $id;
            }
        }

        self::fail("Espace du comptable $accountantId absent des fixtures.");
    }

    protected function fileId(string $reference): string
    {
        return $this->clientFile($reference)->getId()->toRfc4122();
    }

    protected function clientFile(string $reference): ClientFile
    {
        return static::getContainer()->get(ClientFileRepository::class)->findOneBy(['reference' => $reference])
            ?? self::fail("Dossier $reference absent des fixtures.");
    }
}
