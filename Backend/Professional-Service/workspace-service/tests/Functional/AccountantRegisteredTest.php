<?php

namespace App\Tests\Functional;

use App\Messaging\AccountantRegisteredListener;
use App\Repository\AccountantWorkspaceRepository;
use Launchpad\Common\Fixtures\FixtureUsers;
use Launchpad\Common\Messaging\Queues;
use Symfony\Component\Uid\Uuid;

/** Événement accountant.registered (User-Service) : création de l'espace à l'inscription d'un comptable. */
final class AccountantRegisteredTest extends ApiTestCase
{
    public function testListenerConsumesTheSharedQueue(): void
    {
        self::assertSame(Queues::WORKSPACE_ACCOUNTANT_REGISTERED, $this->listener()->queue());
        self::assertSame('workspace.accountant_registered', Queues::WORKSPACE_ACCOUNTANT_REGISTERED);
    }

    public function testNewAccountantGetsAnOpenWorkspaceListedForEntrepreneurs(): void
    {
        $accountantId = Uuid::v4()->toRfc4122();

        $this->listener()->handle(['accountantId' => $accountantId, 'displayName' => 'Inès Haddad', 'email' => 'ines@launchpad.test']);

        $workspace = $this->workspaces()->findOneByAccountantId($accountantId);
        self::assertNotNull($workspace);
        self::assertSame('Inès Haddad', $workspace->getDisplayName());
        self::assertTrue($workspace->isAcceptingClients());
        self::assertTrue($workspace->isActive());

        $listed = $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE)->request('GET', '/workspaces?limit=100')['data'];
        $this->assertStatus(200);
        self::assertContains($accountantId, array_column($listed, 'accountantId'));
    }

    public function testReplayedMessageDoesNotDuplicateTheWorkspace(): void
    {
        $accountantId = Uuid::v4()->toRfc4122();
        $payload = ['accountantId' => $accountantId, 'displayName' => 'Marc Petit'];

        $this->listener()->handle($payload);
        $id = $this->workspaces()->findOneByAccountantId($accountantId)->getId()->toRfc4122();
        $this->listener()->handle($payload);

        self::assertSame($id, $this->workspaces()->findOneByAccountantId($accountantId)->getId()->toRfc4122());
        self::assertSame(1, $this->workspaces()->count(['accountantId' => $accountantId]));
    }

    public function testExistingWorkspaceKeepsItsStateAndOnlyRefreshesTheName(): void
    {
        // Claire a fermé son espace aux demandes : l'événement ne doit pas le rouvrir
        $before = $this->workspaces()->findOneByAccountantId(FixtureUsers::ACCOUNTANT_CLAIRE);
        self::assertFalse($before->isAcceptingClients());
        $name = $before->getDisplayName();

        $this->listener()->handle(['accountantId' => FixtureUsers::ACCOUNTANT_CLAIRE, 'displayName' => 'Claire Dubois-Martin']);

        $after = $this->workspaces()->findOneByAccountantId(FixtureUsers::ACCOUNTANT_CLAIRE);
        self::assertFalse($after->isAcceptingClients());
        self::assertSame('Claire Dubois-Martin', $after->getDisplayName());

        $this->listener()->handle(['accountantId' => FixtureUsers::ACCOUNTANT_CLAIRE, 'displayName' => $name]);
    }

    public function testMessageWithoutAccountantIdIsRejected(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->listener()->handle(['displayName' => 'Sans identifiant']);
    }

    private function listener(): AccountantRegisteredListener
    {
        return static::getContainer()->get(AccountantRegisteredListener::class);
    }

    private function workspaces(): AccountantWorkspaceRepository
    {
        return static::getContainer()->get(AccountantWorkspaceRepository::class);
    }
}
