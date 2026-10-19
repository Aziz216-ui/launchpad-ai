<?php

namespace App\Tests\Functional;

use App\DataFixtures\FixtureUsers;

final class ClientFileTest extends ApiTestCase
{
    public function testEntrepreneurRequestsAnAccountant(): void
    {
        $data = $this->actingAs(FixtureUsers::ENTREPRENEUR_THOMAS)->request('POST', '/files', [
            'workspaceId' => $this->workspaceId(FixtureUsers::ACCOUNTANT_SONIA),
            'startupName' => 'Le Fournil Solidaire',
            'requestMessage' => 'Nous ouvrons notre boulangerie en septembre.',
        ])['data'];

        $this->assertStatus(201);
        self::assertSame('PENDING', $data['status']);
        self::assertMatchesRegularExpression('/^DOS-\d{4}-\d{6}$/', $data['reference']);
        self::assertSame(FixtureUsers::ENTREPRENEUR_THOMAS, $data['entrepreneurId']);
        self::assertSame('Thomas Moreau', $data['entrepreneurDisplayName']);
        self::assertSame(FixtureUsers::ACCOUNTANT_SONIA, $data['workspace']['accountantId']);
        self::assertStringEndsWith('/api/comptable/files/'.$data['id'], $this->client->getResponse()->headers->get('Location'));
    }

    public function testDuplicateOpenRequestIsRefused(): void
    {
        $this->actingAs(FixtureUsers::ENTREPRENEUR_LEILA)->request('POST', '/files', [
            'workspaceId' => $this->workspaceId(FixtureUsers::ACCOUNTANT_SONIA),
            'startupName' => 'MediConnect',
            'startupId' => 'prj-mediconnect-007',
        ]);

        $this->assertError(409, 'DUPLICATE_FILE');
    }

    public function testWorkspaceClosedToNewClientsCannotBeRequested(): void
    {
        $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE)->request('POST', '/files', [
            'workspaceId' => $this->workspaceId(FixtureUsers::ACCOUNTANT_CLAIRE),
            'startupName' => 'AgriSense',
        ]);

        $this->assertError(409, 'WORKSPACE_UNAVAILABLE');
    }

    public function testInvalidRequestReturnsFieldErrors(): void
    {
        $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE)->request('POST', '/files', ['workspaceId' => 'pas-un-uuid']);

        $error = $this->assertError(400, 'VALIDATION_FAILED');
        self::assertEqualsCanonicalizing(['workspaceId', 'startupName'], array_column($error['details'], 'field'));
    }

    public function testMalformedJsonReturns400(): void
    {
        $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE)->requestRaw('POST', '/files', '{"startupName": ');

        $this->assertError(400, 'BAD_REQUEST');
    }

    public function testAccountantCannotCreateRequest(): void
    {
        $this->actingAs(FixtureUsers::ACCOUNTANT_KARIM)->request('POST', '/files', [
            'workspaceId' => $this->workspaceId(FixtureUsers::ACCOUNTANT_SONIA),
            'startupName' => 'Test',
        ]);

        $this->assertError(403, 'FORBIDDEN');
    }

    public function testListIsRestrictedToVisibleFiles(): void
    {
        $amine = $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE)->request('GET', '/files');
        self::assertEqualsCanonicalizing(
            [FixtureUsers::FILE_AGRISENSE, FixtureUsers::FILE_AGRISENSE_EXPORT_CLOSED],
            array_column($amine['data'], 'reference'),
        );

        $karim = $this->actingAs(FixtureUsers::ACCOUNTANT_KARIM)->request('GET', '/files');
        self::assertEqualsCanonicalizing(
            [FixtureUsers::FILE_ECOLIVRAISON, FixtureUsers::FILE_MEDICONNECT_REJECTED, FixtureUsers::FILE_AGRISENSE_EXPORT_CLOSED],
            array_column($karim['data'], 'reference'),
        );

        $admin = $this->actingAs(FixtureUsers::ADMIN_NADIA)->request('GET', '/files');
        self::assertSame(6, $admin['meta']['total']);
    }

    public function testListSupportsStatusFilterAndPagination(): void
    {
        $page = $this->actingAs(FixtureUsers::ADMIN_NADIA)->request('GET', '/files?status=PENDING&page=2&limit=1');

        $this->assertStatus(200);
        self::assertCount(1, $page['data']);
        self::assertSame(['page' => 2, 'limit' => 1, 'total' => 2, 'pages' => 2], $page['meta']);
        self::assertSame('PENDING', $page['data'][0]['status']);
    }

    public function testLimitIsCappedAt100(): void
    {
        $page = $this->actingAs(FixtureUsers::ADMIN_NADIA)->request('GET', '/files?limit=500');

        $this->assertStatus(200);
        self::assertSame(100, $page['meta']['limit']);
    }

    public function testInvalidPaginationOrFilterReturns400(): void
    {
        $this->actingAs(FixtureUsers::ADMIN_NADIA)->request('GET', '/files?page=0');
        $this->assertError(400, 'VALIDATION_FAILED');

        $this->request('GET', '/files?status=ARCHIVED');
        $this->assertError(400, 'VALIDATION_FAILED');
    }

    public function testEntrepreneurCannotSeeSomeoneElsesFile(): void
    {
        $this->actingAs(FixtureUsers::ENTREPRENEUR_LEILA)->request('GET', '/files/'.$this->fileId(FixtureUsers::FILE_AGRISENSE));

        $this->assertError(403, 'FORBIDDEN');
    }

    public function testUnknownFileReturns404(): void
    {
        $this->actingAs(FixtureUsers::ADMIN_NADIA)->request('GET', '/files/0192a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b');

        $this->assertError(404, 'NOT_FOUND');
    }

    public function testAccountantAcceptsPendingRequest(): void
    {
        $fileId = $this->fileId(FixtureUsers::FILE_MEDICONNECT_PENDING);

        $data = $this->actingAs(FixtureUsers::ACCOUNTANT_SONIA)->request('POST', "/files/$fileId/accept")['data'];
        $this->assertStatus(200);
        self::assertSame('ACTIVE', $data['status']);
        self::assertNotNull($data['decidedAt']);

        $history = $this->request('GET', "/files/$fileId/assignments")['data'];
        self::assertCount(1, $history);
        self::assertSame('ACCEPTANCE', $history[0]['type']);
        self::assertNull($history[0]['previousAccountantId']);
        self::assertSame(FixtureUsers::ACCOUNTANT_SONIA, $history[0]['newAccountantId']);

        // Une seconde acceptation n'a plus de sens
        $this->request('POST', "/files/$fileId/accept");
        $this->assertError(409, 'INVALID_STATUS');
    }

    public function testOtherAccountantCannotAcceptRequest(): void
    {
        $this->actingAs(FixtureUsers::ACCOUNTANT_KARIM)->request('POST', '/files/'.$this->fileId(FixtureUsers::FILE_MEDICONNECT_PENDING).'/accept');

        $this->assertError(403, 'FORBIDDEN');
    }

    public function testRejectionRequiresReason(): void
    {
        $fileId = $this->fileId(FixtureUsers::FILE_MEDICONNECT_PENDING);

        $this->actingAs(FixtureUsers::ACCOUNTANT_SONIA)->request('POST', "/files/$fileId/reject", ['reason' => '']);
        $this->assertError(400, 'VALIDATION_FAILED');

        $data = $this->request('POST', "/files/$fileId/reject", ['reason' => 'Agenda complet jusqu\'en janvier.'])['data'];
        $this->assertStatus(200);
        self::assertSame('REJECTED', $data['status']);
        self::assertSame('Agenda complet jusqu\'en janvier.', $data['rejectionReason']);
    }

    public function testEntrepreneurUpdatesPendingRequestOnly(): void
    {
        $pending = $this->fileId(FixtureUsers::FILE_MEDICONNECT_PENDING);
        $data = $this->actingAs(FixtureUsers::ENTREPRENEUR_LEILA)->request('PATCH', "/files/$pending", ['requestMessage' => 'Précision : SAS au capital de 10 000 €.'])['data'];

        $this->assertStatus(200);
        self::assertSame('Précision : SAS au capital de 10 000 €.', $data['requestMessage']);

        $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE)->request('PATCH', '/files/'.$this->fileId(FixtureUsers::FILE_AGRISENSE), ['startupName' => 'Autre']);
        $this->assertError(409, 'INVALID_STATUS');
    }

    public function testAdminAssignsPendingRequestDirectly(): void
    {
        $fileId = $this->fileId(FixtureUsers::FILE_BOULANGERIE_PENDING_CLAIRE);

        $data = $this->actingAs(FixtureUsers::ADMIN_NADIA)->request('POST', "/files/$fileId/assign", [
            'workspaceId' => $this->workspaceId(FixtureUsers::ACCOUNTANT_KARIM),
        ])['data'];

        $this->assertStatus(200);
        self::assertSame('ACTIVE', $data['status']);
        self::assertSame(FixtureUsers::ACCOUNTANT_KARIM, $data['workspace']['accountantId']);

        $history = $this->request('GET', "/files/$fileId/assignments")['data'];
        self::assertSame('ADMIN_ASSIGNMENT', $history[0]['type']);
        self::assertSame(FixtureUsers::ADMIN_NADIA, $history[0]['assignedBy']);
    }

    public function testAdminReassignmentRequiresReasonAndKeepsHistory(): void
    {
        $fileId = $this->fileId(FixtureUsers::FILE_AGRISENSE);
        $karim = $this->workspaceId(FixtureUsers::ACCOUNTANT_KARIM);

        $this->actingAs(FixtureUsers::ADMIN_NADIA)->request('POST', "/files/$fileId/assign", ['workspaceId' => $karim]);
        $error = $this->assertError(400, 'VALIDATION_FAILED');
        self::assertSame('reason', $error['details'][0]['field']);

        $this->request('POST', "/files/$fileId/assign", ['workspaceId' => $karim, 'reason' => 'Congé maternité de Mme Ben Ammar.']);
        $this->assertStatus(200);

        $history = $this->request('GET', "/files/$fileId/assignments")['data'];
        self::assertSame('ADMIN_REASSIGNMENT', $history[0]['type']);
        self::assertSame(FixtureUsers::ACCOUNTANT_SONIA, $history[0]['previousAccountantId']);
        self::assertSame(FixtureUsers::ACCOUNTANT_KARIM, $history[0]['newAccountantId']);
        self::assertSame('ACCEPTANCE', $history[1]['type']);

        // L'ancienne comptable n'a plus accès, le nouveau oui
        $this->actingAs(FixtureUsers::ACCOUNTANT_SONIA)->request('GET', "/files/$fileId");
        $this->assertError(403, 'FORBIDDEN');
        $this->actingAs(FixtureUsers::ACCOUNTANT_KARIM)->request('GET', "/files/$fileId");
        $this->assertStatus(200);
    }

    public function testCannotAssignToDeactivatedWorkspace(): void
    {
        $this->actingAs(FixtureUsers::ADMIN_NADIA)->request('POST', '/files/'.$this->fileId(FixtureUsers::FILE_ECOLIVRAISON).'/assign', [
            'workspaceId' => $this->workspaceId(FixtureUsers::ACCOUNTANT_YOUSSEF),
            'reason' => 'Retour',
        ]);

        $this->assertError(409, 'WORKSPACE_INACTIVE');
    }

    public function testAccountantClosesActiveFile(): void
    {
        $fileId = $this->fileId(FixtureUsers::FILE_ECOLIVRAISON);

        $data = $this->actingAs(FixtureUsers::ACCOUNTANT_KARIM)->request('POST', "/files/$fileId/close")['data'];

        $this->assertStatus(200);
        self::assertSame('CLOSED', $data['status']);
        self::assertNotNull($data['closedAt']);
    }
}
