<?php

namespace App\Tests\Functional;

use App\Repository\AccountantWorkspaceRepository;
use Launchpad\Common\Testing\ApiTestCase as BaseApiTestCase;
use Launchpad\Common\Testing\FakeMessagePublisher;

abstract class ApiTestCase extends BaseApiTestCase
{
    protected function workspaceId(string $accountantId): string
    {
        return static::getContainer()->get(AccountantWorkspaceRepository::class)->findOneByAccountantId($accountantId)?->getId()->toRfc4122()
            ?? self::fail("Espace du comptable $accountantId absent des fixtures.");
    }

    /** Doublure de RabbitMQ : messages publiés pendant le test. */
    protected function rabbitMq(): FakeMessagePublisher
    {
        return static::getContainer()->get(FakeMessagePublisher::class);
    }
}
