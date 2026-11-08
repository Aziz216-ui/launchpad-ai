<?php

namespace App\Tests\Functional;

use App\Service\WorkspaceService;
use Launchpad\Common\Fixtures\FixtureCatalog;
use Launchpad\Common\Fixtures\FixtureUsers;
use Launchpad\Common\Messaging\Message\WorkspaceStatusChanged;
use Launchpad\Common\Messaging\Queues;
use Launchpad\Common\Testing\TestTokenFactory;

final class WorkspaceTest extends ApiTestCase
{
    public function testWorkspaceIsCreatedOnFirstAccountantRequestAndClosedByDefault(): void
    {
        $newAccountant = '0b9e2f6a-8c1d-4e3b-a7f5-2d4c6e8a0b11';
        $this->withToken(TestTokenFactory::create($newAccountant, ['ACCOUNTANT'], ['given_name' => 'Hugo', 'family_name' => 'Lambert']));

        $data = $this->request('GET', '/workspaces/me')['data'];

        $this->assertStatus(200);
        self::assertSame($newAccountant, $data['accountantId']);
        self::assertSame('Hugo Lambert', $data['displayName']);
        self::assertFalse($data['acceptingClients']);
        self::assertTrue($data['active']);
    }

    public function testEntrepreneurOnlySeesAvailableWorkspaces(): void
    {
        $body = $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE)->request('GET', '/workspaces');

        $this->assertStatus(200);
        self::assertSame(2, $body['meta']['total']);
        self::assertEqualsCanonicalizing(['Karim Trabelsi', 'Sonia Ben Ammar'], array_column($body['data'], 'displayName'));
    }

    public function testAdminCanListAllWorkspaces(): void
    {
        $body = $this->actingAs(FixtureUsers::ADMIN_NADIA)->request('GET', '/workspaces?all=true');

        $this->assertStatus(200);
        self::assertSame(4, $body['meta']['total']);
    }

    public function testAccountantOpensWorkspaceToNewClients(): void
    {
        $data = $this->actingAs(FixtureUsers::ACCOUNTANT_CLAIRE)->request('PATCH', '/workspaces/me', ['acceptingClients' => true])['data'];

        $this->assertStatus(200);
        self::assertTrue($data['acceptingClients']);
    }

    public function testAcceptingClientsIsRequired(): void
    {
        $this->actingAs(FixtureUsers::ACCOUNTANT_CLAIRE)->request('PATCH', '/workspaces/me', []);

        $error = $this->assertError(400, 'VALIDATION_FAILED');
        self::assertSame('acceptingClients', $error['details'][0]['field']);
    }

    public function testOnlyAdminCanDeactivateWorkspace(): void
    {
        $workspaceId = $this->workspaceId(FixtureUsers::ACCOUNTANT_SONIA);

        $this->actingAs(FixtureUsers::ACCOUNTANT_SONIA)->request('PATCH', "/workspaces/$workspaceId/status", ['active' => false]);

        $this->assertError(403, 'FORBIDDEN');
    }

    public function testDeactivationPublishesTheEventForClientFileService(): void
    {
        $workspaceId = $this->workspaceId(FixtureUsers::ACCOUNTANT_SONIA);

        $data = $this->actingAs(FixtureUsers::ADMIN_NADIA)->request('PATCH', "/workspaces/$workspaceId/status", ['active' => false])['data'];

        $this->assertStatus(200);
        self::assertFalse($data['active']);

        // Le refus des demandes et le passage en lecture seule sont appliqués par client-file-service, en consommant la queue
        $messages = $this->rabbitMq()->on(Queues::CLIENT_FILE_WORKSPACE_STATUS);
        self::assertCount(1, $messages);
        self::assertInstanceOf(WorkspaceStatusChanged::class, $messages[0]);
        self::assertSame($workspaceId, $messages[0]->workspaceId);
        self::assertFalse($messages[0]->active);
        self::assertSame(WorkspaceService::DEACTIVATION_REASON, $messages[0]->reason);
        self::assertSame(FixtureUsers::ADMIN_NADIA, $messages[0]->changedBy);
    }

    public function testReactivationIsAlsoPublished(): void
    {
        $data = $this->actingAs(FixtureUsers::ADMIN_NADIA)->request('PATCH', '/workspaces/'.FixtureCatalog::WORKSPACE_YOUSSEF.'/status', ['active' => true])['data'];

        $this->assertStatus(200);
        self::assertTrue($data['active']);
        self::assertTrue($this->rabbitMq()->on(Queues::CLIENT_FILE_WORKSPACE_STATUS)[0]->active);
    }

    public function testUnchangedStatusPublishesNothing(): void
    {
        $this->actingAs(FixtureUsers::ADMIN_NADIA)->request('PATCH', '/workspaces/'.FixtureCatalog::WORKSPACE_SONIA.'/status', ['active' => true]);

        $this->assertStatus(200);
        self::assertSame([], $this->rabbitMq()->published);
    }

    public function testWorkspaceIsUnchangedWhenRabbitMqIsUnavailable(): void
    {
        $workspaceId = $this->workspaceId(FixtureUsers::ACCOUNTANT_SONIA);
        $this->rabbitMq()->unavailable = true;

        $this->actingAs(FixtureUsers::ADMIN_NADIA)->request('PATCH', "/workspaces/$workspaceId/status", ['active' => false]);

        $this->assertError(503, 'SERVICE_UNAVAILABLE');
        $workspace = $this->actingAs(FixtureUsers::ACCOUNTANT_SONIA)->request('GET', '/workspaces/me')['data'];
        self::assertTrue($workspace['active']);
    }

    public function testInternalRouteRequiresTheSharedKey(): void
    {
        $this->internal('GET', '/workspaces/'.FixtureCatalog::WORKSPACE_SONIA, key: null);
        $this->assertError(401, 'INVALID_INTERNAL_KEY');

        $this->internal('GET', '/workspaces/'.FixtureCatalog::WORKSPACE_SONIA, key: 'mauvaise-cle');
        $this->assertError(401, 'INVALID_INTERNAL_KEY');
    }

    public function testInternalRouteExposesWorkspaceToOtherServices(): void
    {
        $data = $this->internal('GET', '/workspaces/'.FixtureCatalog::WORKSPACE_YOUSSEF)['data'];

        $this->assertStatus(200);
        self::assertSame(FixtureUsers::ACCOUNTANT_YOUSSEF, $data['accountantId']);
        self::assertFalse($data['active']);

        $this->internal('GET', '/workspaces/019a1000-0000-7000-8000-0000000000ff');
        $this->assertStatus(404);
    }
}
