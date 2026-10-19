<?php

namespace App\Tests\Functional;

use App\DataFixtures\FixtureUsers;
use App\Enum\ClientFileStatus;
use App\Service\WorkspaceService;
use App\Tests\Security\TestTokenFactory;

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

    public function testDeactivationRejectsPendingRequestsAndKeepsActiveFilesReadOnly(): void
    {
        $workspaceId = $this->workspaceId(FixtureUsers::ACCOUNTANT_SONIA);

        $data = $this->actingAs(FixtureUsers::ADMIN_NADIA)->request('PATCH', "/workspaces/$workspaceId/status", ['active' => false])['data'];

        $this->assertStatus(200);
        self::assertFalse($data['active']);
        self::assertSame(1, $data['autoRejectedRequests']);

        // La demande en attente de Leïla est refusée automatiquement
        $pending = $this->actingAs(FixtureUsers::ENTREPRENEUR_LEILA)->request('GET', '/files/'.$this->fileId(FixtureUsers::FILE_MEDICONNECT_PENDING))['data'];
        self::assertSame(ClientFileStatus::REJECTED->value, $pending['status']);
        self::assertSame(WorkspaceService::DEACTIVATION_REASON, $pending['rejectionReason']);

        // Le dossier actif reste lisible par la comptable, mais elle ne peut plus agir
        $activeFile = $this->fileId(FixtureUsers::FILE_AGRISENSE);
        $this->actingAs(FixtureUsers::ACCOUNTANT_SONIA)->request('GET', "/files/$activeFile");
        $this->assertStatus(200);

        $this->request('POST', '/documents/'.$this->documentId('Relevé bancaire — mars 2026').'/validate');
        $this->assertError(403, 'FORBIDDEN');

        $this->request('POST', "/files/$activeFile/messages", ['content' => 'Test']);
        $this->assertError(403, 'FORBIDDEN');
    }
}
