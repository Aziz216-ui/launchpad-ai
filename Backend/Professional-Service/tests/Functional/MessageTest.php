<?php

namespace App\Tests\Functional;

use App\DataFixtures\FixtureUsers;

final class MessageTest extends ApiTestCase
{
    public function testThreadIsListedNewestFirst(): void
    {
        $body = $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE)->request('GET', '/files/'.$this->fileId(FixtureUsers::FILE_AGRISENSE).'/messages');

        $this->assertStatus(200);
        self::assertSame(4, $body['meta']['total']);
        self::assertSame('ACCOUNTANT', $body['data'][0]['senderRole']);
        self::assertStringStartsWith('Parfait', $body['data'][0]['content']);
    }

    public function testParticipantsExchangeMessagesAboutADocument(): void
    {
        $fileId = $this->fileId(FixtureUsers::FILE_AGRISENSE);
        $documentId = $this->documentId('Bilan 2025');

        $data = $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE)->request('POST', "/files/$fileId/messages", [
            'content' => 'Pouvez-vous me confirmer la date limite de dépôt de la liasse fiscale ?',
            'documentId' => $documentId,
        ])['data'];

        $this->assertStatus(201);
        self::assertSame('ENTREPRENEUR', $data['senderRole']);
        self::assertSame($documentId, $data['documentId']);
        self::assertNull($data['readAt']);

        // L'expéditeur ne peut pas marquer son propre message comme lu ; la destinataire, si
        $this->request('POST', '/messages/'.$data['id'].'/read');
        $this->assertError(403, 'FORBIDDEN');

        $read = $this->actingAs(FixtureUsers::ACCOUNTANT_SONIA)->request('POST', '/messages/'.$data['id'].'/read')['data'];
        $this->assertStatus(200);
        self::assertNotNull($read['readAt']);
    }

    public function testMessagesArePossibleOnPendingRequest(): void
    {
        $this->actingAs(FixtureUsers::ACCOUNTANT_SONIA)->request('POST', '/files/'.$this->fileId(FixtureUsers::FILE_MEDICONNECT_PENDING).'/messages', [
            'content' => 'Bonjour Leïla, oui, mardi 10 h vous convient-il ?',
        ]);

        $this->assertStatus(201);
    }

    public function testDocumentMustBelongToTheFile(): void
    {
        $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE)->request('POST', '/files/'.$this->fileId(FixtureUsers::FILE_AGRISENSE).'/messages', [
            'content' => 'Voir ce document',
            'documentId' => $this->documentId('Déclaration de TVA — T1 2026'),
        ]);

        self::assertSame('documentId', $this->assertError(400, 'VALIDATION_FAILED')['details'][0]['field']);
    }

    public function testEmptyMessageIsRejected(): void
    {
        $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE)->request('POST', '/files/'.$this->fileId(FixtureUsers::FILE_AGRISENSE).'/messages', ['content' => '   ']);

        $this->assertError(400, 'VALIDATION_FAILED');
    }

    public function testNoMessagesOnClosedFile(): void
    {
        $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE)->request('POST', '/files/'.$this->fileId(FixtureUsers::FILE_AGRISENSE_EXPORT_CLOSED).'/messages', ['content' => 'Bonjour']);

        $this->assertError(409, 'FILE_CLOSED');
    }

    public function testAdminCannotWriteMessages(): void
    {
        $fileId = $this->fileId(FixtureUsers::FILE_AGRISENSE);
        $this->actingAs(FixtureUsers::ADMIN_NADIA);

        $this->request('GET', "/files/$fileId/messages");
        $this->assertStatus(200);

        $this->request('POST', "/files/$fileId/messages", ['content' => 'Bonjour']);
        $this->assertError(403, 'FORBIDDEN');
    }
}
