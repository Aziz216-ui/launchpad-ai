<?php

namespace App\Tests\Functional;

use App\Messaging\DocumentDecidedListener;
use Launchpad\Common\Fixtures\FixtureCatalog;
use Launchpad\Common\Fixtures\FixtureUsers;
use Launchpad\Common\Messaging\QueueConsumer;
use Launchpad\Common\Messaging\Queues;
use Launchpad\Common\Remote\Model\FileContext;

final class MessageTest extends ApiTestCase
{
    public function testAccountantWithDeactivatedWorkspaceCanReadButNotWrite(): void
    {
        // client-file-service signale que l'espace de Sonia est désactivé
        $file = FixtureCatalog::fileContext(FixtureCatalog::FILE_AGRISENSE);
        $this->clientFiles()->override(new FileContext($file->id, $file->reference, $file->status, $file->entrepreneurId, $file->accountantId, workspaceActive: false));

        $this->actingAs(FixtureUsers::ACCOUNTANT_SONIA)->request('GET', "/files/{$file->id}/messages");
        $this->assertStatus(200);

        $this->request('POST', "/files/{$file->id}/messages", ['content' => 'Test']);
        $this->assertError(403, 'FORBIDDEN');
    }

    public function testDeletedDocumentCannotBeCited(): void
    {
        $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE)->request('POST', '/files/'.FixtureCatalog::FILE_AGRISENSE.'/messages', [
            'content' => 'Voir ce document',
            'documentId' => FixtureCatalog::DOC_DOUBLON_DELETED,
        ]);

        self::assertSame('documentId', $this->assertError(400, 'VALIDATION_FAILED')['details'][0]['field']);
    }

    public function testUnknownFileReturns404(): void
    {
        $this->actingAs(FixtureUsers::ADMIN_NADIA)->request('GET', '/files/019a2000-0000-7000-8000-0000000000ff/messages');

        $this->assertError(404, 'NOT_FOUND');
    }

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

    public function testDocumentRejectionMessageNotifiesTheEntrepreneur(): void
    {
        // Message publié par document-service sur RabbitMQ quand Sonia rejette le relevé d'Amine
        $this->documentDecidedListener()->handle($this->decision('REJECTED', 'Le relevé est illisible.'));

        $thread = $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE)->request('GET', '/files/'.FixtureCatalog::FILE_AGRISENSE.'/messages');
        $notification = $thread['data'][0];

        self::assertSame(5, $thread['meta']['total']);
        self::assertTrue($notification['automatic']);
        self::assertSame('ACCOUNTANT', $notification['senderRole']);
        self::assertSame(FixtureUsers::ACCOUNTANT_SONIA, $notification['senderId']);
        self::assertSame(FixtureCatalog::DOC_RELEVE, $notification['documentId']);
        self::assertSame(
            "Document « Relevé bancaire — mars 2026 » (v1) rejeté.\nMotif : Le relevé est illisible.\nVous pouvez déposer une nouvelle version depuis l'onglet Documents.",
            $notification['content'],
        );
        self::assertNull($notification['readAt']);

        // L'entrepreneur, destinataire, peut la marquer comme lue
        $this->request('POST', '/messages/'.$notification['id'].'/read');
        $this->assertStatus(200);
    }

    public function testValidationAndRevisionMessages(): void
    {
        $listener = $this->documentDecidedListener();
        $listener->handle($this->decision('VALIDATED', null));
        $listener->handle($this->decision('REJECTED', 'Finalement, il manque une page.', revision: true));

        $thread = $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE)->request('GET', '/files/'.FixtureCatalog::FILE_AGRISENSE.'/messages')['data'];

        self::assertStringStartsWith('Décision révisée : document « Relevé bancaire — mars 2026 » (v1) rejeté.', $thread[0]['content']);
        self::assertSame('Document « Relevé bancaire — mars 2026 » (v1) validé.', $thread[1]['content']);
    }

    public function testManualMessagesAreNotAutomatic(): void
    {
        $data = $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE)->request('POST', '/files/'.FixtureCatalog::FILE_AGRISENSE.'/messages', ['content' => 'Bonjour'])['data'];

        self::assertFalse($data['automatic']);
    }

    public function testListenerDeclaresTheDocumentQueue(): void
    {
        self::assertSame([Queues::MESSAGE_DOCUMENT_DECIDED], static::getContainer()->get(QueueConsumer::class)->queues());
    }

    private function documentDecidedListener(): DocumentDecidedListener
    {
        return static::getContainer()->get(DocumentDecidedListener::class);
    }

    /**
     * @return array<string, mixed>
     */
    private function decision(string $decision, ?string $comment, bool $revision = false): array
    {
        return [
            'documentId' => FixtureCatalog::DOC_RELEVE,
            'clientFileId' => FixtureCatalog::FILE_AGRISENSE,
            'title' => 'Relevé bancaire — mars 2026',
            'versionNumber' => 1,
            'decision' => $decision,
            'comment' => $comment,
            'revision' => $revision,
            'accountantId' => FixtureUsers::ACCOUNTANT_SONIA,
            'decidedAt' => '2026-11-06T10:00:00+00:00',
        ];
    }
}
