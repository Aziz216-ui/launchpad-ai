<?php

namespace App\DataFixtures;

use App\Entity\AccountingDocument;
use App\Entity\DocumentEvent;
use App\Entity\Validation;
use App\Enum\DocumentEventType;
use App\Enum\DocumentStatus;
use App\Enum\DocumentType;
use App\Enum\ValidationDecision;
use App\Service\DocumentService;
use App\Storage\DocumentStorageInterface;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;
use Launchpad\Common\Enum\UserRole;
use Launchpad\Common\Fixtures\FixtureCatalog;
use Launchpad\Common\Fixtures\FixtureUsers;
use Symfony\Component\Filesystem\Filesystem;

/**
 * Documents de démonstration (déposés, externes, versionnés, supprimés) et leurs validations.
 * Dossiers et identifiants : catalogue partagé (FixtureCatalog).
 */
final class AppFixtures extends Fixture
{
    private ObjectManager $manager;

    public function __construct(private readonly DocumentStorageInterface $storage)
    {
    }

    public function load(ObjectManager $manager): void
    {
        $this->manager = $manager;

        // --- AgriSense (Amine), suivi par Sonia ---------------------------------------
        $agrisense = FixtureCatalog::FILE_AGRISENSE;

        $bilan = $this->upload(FixtureCatalog::DOC_BILAN, $agrisense, DocumentType::BALANCE_SHEET, 'bilan-2025.pdf', FixtureUsers::ENTREPRENEUR_AMINE, UserRole::ENTREPRENEUR, '2025-01-01', '2025-12-31');
        $this->decide($bilan, FixtureUsers::ACCOUNTANT_SONIA, ValidationDecision::VALIDATED, 'Bilan conforme, merci pour la clarté des annexes.');

        $this->upload(FixtureCatalog::DOC_RELEVE, $agrisense, DocumentType::BANK_STATEMENT, 'releve-banque-2026-03.pdf', FixtureUsers::ENTREPRENEUR_AMINE, UserRole::ENTREPRENEUR, '2026-03-01', '2026-03-31');

        $previsionnel = AccountingDocument::external($agrisense, $this->title(FixtureCatalog::DOC_PREVISIONNEL), DocumentType::FINANCIAL_FORECAST,
            FixtureUsers::ENTREPRENEUR_AMINE, UserRole::ENTREPRENEUR, 'FIN-PREV-2026-0042', 'financial-service');
        FixtureCatalog::forceId($previsionnel, FixtureCatalog::DOC_PREVISIONNEL);
        $previsionnel->setPeriod(new \DateTimeImmutable('2026-01-01'), new \DateTimeImmutable('2028-12-31'));
        $manager->persist($previsionnel);

        // Version 1 rejetée puis version 2 en attente
        $facturesV1 = $this->upload(FixtureCatalog::DOC_FACTURES_V1, $agrisense, DocumentType::INVOICE, 'factures-t1-2026.pdf', FixtureUsers::ENTREPRENEUR_AMINE, UserRole::ENTREPRENEUR, '2026-01-01', '2026-03-31');
        $this->decide($facturesV1, FixtureUsers::ACCOUNTANT_SONIA, ValidationDecision::REJECTED, 'Il manque les factures de février (fournisseur Hydrotech).');
        $facturesV2 = $this->upload(FixtureCatalog::DOC_FACTURES_V2, $agrisense, DocumentType::INVOICE, 'factures-t1-2026-v2.pdf', FixtureUsers::ENTREPRENEUR_AMINE, UserRole::ENTREPRENEUR, '2026-01-01', '2026-03-31');
        $facturesV2->replaces($facturesV1);

        // Document du comptable : validé d'office
        $this->upload(FixtureCatalog::DOC_RAPPORT, $agrisense, DocumentType::REPORT, 'rapport-revue-t1-2026.pdf', FixtureUsers::ACCOUNTANT_SONIA, UserRole::ACCOUNTANT, '2026-01-01', '2026-03-31');

        // Document supprimé logiquement par l'entrepreneur (erreur de dépôt)
        $doublon = $this->upload(FixtureCatalog::DOC_DOUBLON_DELETED, $agrisense, DocumentType::BANK_STATEMENT, 'releve-doublon.pdf', FixtureUsers::ENTREPRENEUR_AMINE, UserRole::ENTREPRENEUR, '2026-03-01', '2026-03-31');
        $doublon->softDelete();
        $manager->persist(new DocumentEvent($doublon, DocumentEventType::DELETED, FixtureUsers::ENTREPRENEUR_AMINE, UserRole::ENTREPRENEUR, 'Déposé deux fois par erreur.'));

        // --- ÉcoLivraison (Thomas), réaffecté à Karim -----------------------------------
        $this->upload(FixtureCatalog::DOC_TVA, FixtureCatalog::FILE_ECOLIVRAISON, DocumentType::TAX_RETURN, 'tva-t1-2026.pdf', FixtureUsers::ENTREPRENEUR_THOMAS, UserRole::ENTREPRENEUR, '2026-01-01', '2026-03-31');
        $this->upload(FixtureCatalog::DOC_PAIE, FixtureCatalog::FILE_ECOLIVRAISON, DocumentType::PAYROLL, 'paie-2026-03.pdf', FixtureUsers::ENTREPRENEUR_THOMAS, UserRole::ENTREPRENEUR, '2026-03-01', '2026-03-31');

        // --- AgriSense Export (clôturé), chez Karim --------------------------------------
        $this->upload(FixtureCatalog::DOC_COMPTES_ANNUELS, FixtureCatalog::FILE_AGRISENSE_EXPORT_CLOSED, DocumentType::INCOME_STATEMENT, 'comptes-annuels-2025.pdf', FixtureUsers::ACCOUNTANT_KARIM, UserRole::ACCOUNTANT, '2025-01-01', '2025-12-31');

        $manager->flush();
    }

    private function title(string $documentId): string
    {
        return FixtureCatalog::DOCUMENTS[$documentId]['title'];
    }

    private function upload(string $id, string $fileId, DocumentType $type, string $filename, string $uploadedBy, UserRole $role, string $periodStart, string $periodEnd): AccountingDocument
    {
        $title = $this->title($id);
        $content = $this->pdf($title);
        $temp = (new Filesystem())->tempnam(sys_get_temp_dir(), 'fixture_');
        file_put_contents($temp, $content);

        $key = $this->storage->store(new \SplFileInfo($temp), $fileId, 'pdf');
        unlink($temp);

        $document = AccountingDocument::uploaded($fileId, $title, $type, $uploadedBy, $role, $key, $filename,
            'application/pdf', \strlen($content), hash('sha256', $content));
        FixtureCatalog::forceId($document, $id);
        $document->setPeriod(new \DateTimeImmutable($periodStart), new \DateTimeImmutable($periodEnd));
        $this->manager->persist($document);

        if (UserRole::ACCOUNTANT === $role) {
            // Même règle que l'API : document du comptable validé d'office, avec trace
            $this->manager->persist(new Validation($document, $uploadedBy, ValidationDecision::VALIDATED,
                DocumentStatus::PENDING, DocumentService::ACCOUNTANT_UPLOAD_COMMENT, automatic: true));
            $document->changeStatus(DocumentStatus::VALIDATED);
        }

        return $document;
    }

    private function decide(AccountingDocument $document, string $accountantId, ValidationDecision $decision, string $comment): void
    {
        $this->manager->persist(new Validation($document, $accountantId, $decision, $document->getStatus(), $comment));
        $document->changeStatus($decision->toDocumentStatus());
    }

    /** PDF minimal valide (une page avec le titre) pour la démonstration. */
    private function pdf(string $title): string
    {
        $text = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], iconv('UTF-8', 'Windows-1252//TRANSLIT', $title) ?: $title);
        $stream = "BT /F1 18 Tf 72 720 Td ($text) Tj ET";

        $objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
            sprintf("<< /Length %d >>\nstream\n%s\nendstream", \strlen($stream), $stream),
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
        ];

        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $i => $object) {
            $offsets[] = \strlen($pdf);
            $pdf .= sprintf("%d 0 obj\n%s\nendobj\n", $i + 1, $object);
        }

        $xref = \strlen($pdf);
        $pdf .= sprintf("xref\n0 %d\n0000000000 65535 f \n", \count($objects) + 1);
        foreach ($offsets as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }

        return $pdf.sprintf("trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", \count($objects) + 1, $xref);
    }
}
