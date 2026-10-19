<?php

namespace App\Tests\Functional;

use App\DataFixtures\FixtureUsers;
use App\Repository\DocumentEventRepository;

final class DocumentTest extends ApiTestCase
{
    public function testListReturnsLatestVersionsOnlyUnlessHistoryRequested(): void
    {
        $fileId = $this->fileId(FixtureUsers::FILE_AGRISENSE);

        $latest = $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE)->request('GET', "/files/$fileId/documents");
        $this->assertStatus(200);
        $titles = array_column($latest['data'], 'title');
        self::assertSame(5, $latest['meta']['total']);
        self::assertContains('Factures fournisseurs T1 2026 (complètes)', $titles);
        self::assertNotContains('Factures fournisseurs T1 2026', $titles, 'La version rejetée remplacée ne doit pas apparaître.');
        self::assertNotContains('Relevé bancaire — mars 2026 (doublon)', $titles, 'Un document supprimé ne doit pas apparaître.');

        $all = $this->request('GET', "/files/$fileId/documents?includeHistory=true");
        self::assertSame(6, $all['meta']['total']);

        $rejected = $this->request('GET', "/files/$fileId/documents?includeHistory=true&status=REJECTED");
        self::assertSame(['Factures fournisseurs T1 2026'], array_column($rejected['data'], 'title'));
    }

    public function testEntrepreneurUploadsDocumentAndDownloadsIt(): void
    {
        $fileId = $this->fileId(FixtureUsers::FILE_AGRISENSE);
        $content = $this->pdfContent();

        $data = $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE)->upload("/files/$fileId/documents", [
            'title' => 'Relevé bancaire — avril 2026',
            'type' => 'BANK_STATEMENT',
            'periodStart' => '2026-04-01',
            'periodEnd' => '2026-04-30',
        ], $this->makeUpload('relevé avril.pdf', $content))['data'];

        $this->assertStatus(201);
        self::assertSame('PENDING', $data['status']);
        self::assertSame('UPLOAD', $data['source']);
        self::assertSame('ENTREPRENEUR', $data['uploadedByRole']);
        self::assertSame(1, $data['versionNumber']);
        self::assertSame('2026-04-01', $data['periodStart']);
        self::assertSame('application/pdf', $data['file']['mimeType']);
        self::assertSame(\strlen($content), $data['file']['size']);
        self::assertSame(hash('sha256', $content), $data['file']['checksum']);
        self::assertNull($data['external']);

        // Téléchargement contrôlé : la comptable du dossier y a accès
        $downloadUri = substr($data['file']['downloadUrl'], \strlen(self::PREFIX));
        self::assertSame('/documents/'.$data['id'].'/download', $downloadUri);
        $this->actingAs(FixtureUsers::ACCOUNTANT_SONIA)->request('GET', $downloadUri);
        $this->assertStatus(200);
        $response = $this->client->getResponse();
        self::assertSame($content, $this->client->getInternalResponse()->getContent());
        self::assertSame('application/pdf', $response->headers->get('Content-Type'));
        self::assertStringContainsString('attachment', $response->headers->get('Content-Disposition'));
        self::assertSame('nosniff', $response->headers->get('X-Content-Type-Options'));

        // Un autre entrepreneur n'y a pas accès
        $this->actingAs(FixtureUsers::ENTREPRENEUR_LEILA)->request('GET', $downloadUri);
        $this->assertError(403, 'FORBIDDEN');
    }

    public function testAccountantUploadIsValidatedAutomatically(): void
    {
        $fileId = $this->fileId(FixtureUsers::FILE_AGRISENSE);

        $data = $this->actingAs(FixtureUsers::ACCOUNTANT_SONIA)->upload("/files/$fileId/documents", [
            'title' => 'Déclaration de TVA — avril 2026',
            'type' => 'TAX_RETURN',
        ], $this->makeUpload('tva-avril.pdf', $this->pdfContent()))['data'];

        $this->assertStatus(201);
        self::assertSame('VALIDATED', $data['status']);
        self::assertSame('ACCOUNTANT', $data['uploadedByRole']);

        $history = $this->request('GET', '/documents/'.$data['id'].'/validations')['data'];
        self::assertCount(1, $history);
        self::assertTrue($history[0]['automatic']);
        self::assertSame('VALIDATED', $history[0]['decision']);

        // Pas de circuit de validation pour un document du comptable
        $this->request('POST', '/documents/'.$data['id'].'/reject', ['comment' => 'Erreur']);
        $this->assertError(409, 'VALIDATION_NOT_APPLICABLE');
    }

    public function testUploadRejectsMissingFileForbiddenFormatsAndSpoofedContent(): void
    {
        $uri = '/files/'.$this->fileId(FixtureUsers::FILE_AGRISENSE).'/documents';
        $fields = ['title' => 'Pièce', 'type' => 'OTHER'];
        $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE);

        $this->upload($uri, $fields, null);
        self::assertSame('file', $this->assertError(400, 'VALIDATION_FAILED')['details'][0]['field']);

        $this->upload($uri, $fields, $this->makeUpload('notes.txt', 'texte brut', 'text/plain'));
        $this->assertError(400, 'VALIDATION_FAILED');

        // Extension .pdf mais contenu texte : le type MIME réel est vérifié
        $this->upload($uri, $fields, $this->makeUpload('faux.pdf', 'ceci n\'est pas un PDF'));
        $this->assertError(400, 'VALIDATION_FAILED');
    }

    public function testUploadMetadataIsValidated(): void
    {
        $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE)->upload('/files/'.$this->fileId(FixtureUsers::FILE_AGRISENSE).'/documents', [
            'title' => '',
            'type' => 'UNKNOWN_TYPE',
        ], $this->makeUpload('a.pdf', $this->pdfContent()));

        $error = $this->assertError(400, 'VALIDATION_FAILED');
        self::assertContains('type', array_column($error['details'], 'field'));
    }

    public function testNoUploadOnClosedFile(): void
    {
        $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE)->upload('/files/'.$this->fileId(FixtureUsers::FILE_AGRISENSE_EXPORT_CLOSED).'/documents', [
            'title' => 'Tardif',
            'type' => 'OTHER',
        ], $this->makeUpload('tardif.pdf', $this->pdfContent()));

        $this->assertError(409, 'FILE_NOT_ACTIVE');
    }

    public function testEntrepreneurDeclaresExternalDocument(): void
    {
        $data = $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE)->request('POST', '/files/'.$this->fileId(FixtureUsers::FILE_AGRISENSE).'/documents/external', [
            'title' => 'Plan de trésorerie 2026',
            'type' => 'BUDGET',
            'externalRef' => 'FIN-TRESO-2026-0007',
            'externalService' => 'financial-service',
        ])['data'];

        $this->assertStatus(201);
        self::assertSame('EXTERNAL', $data['source']);
        self::assertSame(['ref' => 'FIN-TRESO-2026-0007', 'service' => 'financial-service'], $data['external']);
        self::assertNull($data['file']);

        $this->request('GET', '/documents/'.$data['id'].'/download');
        $this->assertError(409, 'EXTERNAL_DOCUMENT');
    }

    public function testRejectionRequiresCommentAndRevisionKeepsHistory(): void
    {
        $documentId = $this->documentId('Relevé bancaire — mars 2026');
        $this->actingAs(FixtureUsers::ACCOUNTANT_SONIA);

        $this->request('POST', "/documents/$documentId/reject");
        self::assertSame('comment', $this->assertError(400, 'VALIDATION_FAILED')['details'][0]['field']);

        $result = $this->request('POST', "/documents/$documentId/reject", ['comment' => 'Le relevé est illisible.'])['data'];
        $this->assertStatus(201);
        self::assertSame('REJECTED', $result['document']['status']);
        self::assertFalse($result['validation']['revision']);

        // Révision : commentaire obligatoire, même pour valider
        $this->request('POST', "/documents/$documentId/validate");
        $this->assertError(400, 'VALIDATION_FAILED');

        $result = $this->request('POST', "/documents/$documentId/validate", ['comment' => 'Version lisible reçue par e-mail, c\'est bon.'])['data'];
        self::assertSame('VALIDATED', $result['document']['status']);
        self::assertTrue($result['validation']['revision']);
        self::assertSame('REJECTED', $result['validation']['previousStatus']);

        $history = $this->request('GET', "/documents/$documentId/validations")['data'];
        self::assertSame(['VALIDATED', 'REJECTED'], array_column($history, 'decision'));

        $this->request('POST', "/documents/$documentId/validate", ['comment' => 'Encore']);
        $this->assertError(400, 'SAME_DECISION');
    }

    public function testOnlyAssignedAccountantCanDecide(): void
    {
        $documentId = $this->documentId('Relevé bancaire — mars 2026');

        foreach ([FixtureUsers::ADMIN_NADIA, FixtureUsers::ENTREPRENEUR_AMINE, FixtureUsers::ACCOUNTANT_KARIM] as $user) {
            $this->actingAs($user)->request('POST', "/documents/$documentId/validate");
            $this->assertError(403, 'FORBIDDEN');
        }
    }

    public function testDecisionCannotBeRevisedOnceNewerVersionExists(): void
    {
        $this->actingAs(FixtureUsers::ACCOUNTANT_SONIA)->request('POST', '/documents/'.$this->documentId('Factures fournisseurs T1 2026').'/validate', ['comment' => 'Finalement OK']);

        $this->assertError(409, 'NEWER_VERSION_EXISTS');
    }

    public function testNewVersionOfRejectedDocument(): void
    {
        $documentId = $this->documentId('Relevé bancaire — mars 2026');
        $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE);

        // Pas de nouvelle version tant que le document n'est pas rejeté
        $fields = ['title' => 'Relevé bancaire — mars 2026 (lisible)', 'type' => 'BANK_STATEMENT'];
        $this->upload("/documents/$documentId/versions", $fields, $this->makeUpload('releve-v2.pdf', $this->pdfContent()));
        $this->assertError(409, 'INVALID_STATUS');

        $this->actingAs(FixtureUsers::ACCOUNTANT_SONIA)->request('POST', "/documents/$documentId/reject", ['comment' => 'Illisible.']);

        $version = $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE)
            ->upload("/documents/$documentId/versions", $fields, $this->makeUpload('releve-v2.pdf', $this->pdfContent()))['data'];
        $this->assertStatus(201);
        self::assertSame(2, $version['versionNumber']);
        self::assertSame($documentId, $version['previousVersionId']);
        self::assertSame('PENDING', $version['status']);

        // Une seule version suivante par document
        $this->upload("/documents/$documentId/versions", $fields, $this->makeUpload('releve-v3.pdf', $this->pdfContent()));
        $this->assertError(409, 'NEWER_VERSION_EXISTS');
    }

    public function testEntrepreneurSoftDeletesOwnPendingDocument(): void
    {
        $documentId = $this->documentId('Relevé bancaire — mars 2026');

        $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE)->request('DELETE', "/documents/$documentId");
        $this->assertStatus(204);

        $this->request('GET', "/documents/$documentId");
        $this->assertError(404, 'NOT_FOUND');

        // Trace conservée
        $events = static::getContainer()->get(DocumentEventRepository::class)->findBy(['document' => $documentId]);
        self::assertCount(1, $events);
        self::assertSame('DELETED', $events[0]->getType()->value);
        self::assertSame(FixtureUsers::ENTREPRENEUR_AMINE, $events[0]->getActorId());
    }

    public function testDeletionRules(): void
    {
        // Document validé : plus supprimable par l'entrepreneur
        $this->actingAs(FixtureUsers::ENTREPRENEUR_AMINE)->request('DELETE', '/documents/'.$this->documentId('Bilan 2025'));
        $this->assertError(409, 'INVALID_STATUS');

        // Document du comptable : l'entrepreneur ne peut pas le supprimer
        $this->request('DELETE', '/documents/'.$this->documentId('Rapport de revue comptable T1 2026'));
        $this->assertError(403, 'FORBIDDEN');

        // ... mais la comptable du dossier, oui
        $this->actingAs(FixtureUsers::ACCOUNTANT_SONIA)->request('DELETE', '/documents/'.$this->documentId('Rapport de revue comptable T1 2026'));
        $this->assertStatus(204);

        // Dossier clôturé : aucune suppression
        $this->actingAs(FixtureUsers::ACCOUNTANT_KARIM)->request('DELETE', '/documents/'.$this->documentId('Comptes annuels 2025'));
        $this->assertError(409, 'FILE_NOT_ACTIVE');
    }

    public function testAdminHasReadOnlyAccess(): void
    {
        $documentId = $this->documentId('Bilan 2025');
        $this->actingAs(FixtureUsers::ADMIN_NADIA);

        $this->request('GET', "/documents/$documentId");
        $this->assertStatus(200);

        $this->upload('/files/'.$this->fileId(FixtureUsers::FILE_AGRISENSE).'/documents', ['title' => 'X', 'type' => 'OTHER'], $this->makeUpload('x.pdf', $this->pdfContent()));
        $this->assertError(403, 'FORBIDDEN');
    }
}
