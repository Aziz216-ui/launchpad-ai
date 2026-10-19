<?php

namespace App\DataFixtures;

use App\Entity\AccountantWorkspace;
use App\Entity\AccountingDocument;
use App\Entity\ClientFile;
use App\Entity\ClientFileAssignment;
use App\Entity\DocumentEvent;
use App\Entity\Message;
use App\Entity\Validation;
use App\Enum\AssignmentType;
use App\Enum\DocumentEventType;
use App\Enum\DocumentStatus;
use App\Enum\DocumentType;
use App\Enum\UserRole;
use App\Enum\ValidationDecision;
use App\Service\DocumentService;
use App\Storage\DocumentStorageInterface;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;
use Symfony\Component\Filesystem\Filesystem;

/**
 * Données de démonstration : comptables, entrepreneurs, dossiers dans tous les statuts,
 * documents (déposés, externes, versionnés, supprimés), validations et messages.
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

        // --- Espaces comptables ---------------------------------------------------
        $sonia = $this->workspace(FixtureUsers::ACCOUNTANT_SONIA, 'Sonia Ben Ammar', accepting: true);
        $karim = $this->workspace(FixtureUsers::ACCOUNTANT_KARIM, 'Karim Trabelsi', accepting: true);
        // Espace créé à la première connexion, pas encore ouvert aux demandes
        $claire = $this->workspace(FixtureUsers::ACCOUNTANT_CLAIRE, 'Claire Dubois', accepting: false);
        $youssef = $this->workspace(FixtureUsers::ACCOUNTANT_YOUSSEF, 'Youssef Mansouri', accepting: true);

        // --- Dossier actif complet : AgriSense (Amine) suivi par Sonia ---------------
        $agrisense = $this->file(FixtureUsers::FILE_AGRISENSE, $sonia, FixtureUsers::ENTREPRENEUR_AMINE, 'Amine Jaziri',
            'AgriSense', 'prj-agrisense-001',
            'Bonjour, nous lançons une solution de capteurs connectés pour l\'irrigation. Nous cherchons un accompagnement pour notre premier exercice.');
        $this->accept($agrisense, $sonia);

        $bilan = $this->upload($agrisense, 'Bilan 2025', DocumentType::BALANCE_SHEET, 'bilan-2025.pdf', FixtureUsers::ENTREPRENEUR_AMINE, UserRole::ENTREPRENEUR, '2025-01-01', '2025-12-31');
        $this->decide($bilan, $sonia, ValidationDecision::VALIDATED, 'Bilan conforme, merci pour la clarté des annexes.');

        $releve = $this->upload($agrisense, 'Relevé bancaire — mars 2026', DocumentType::BANK_STATEMENT, 'releve-banque-2026-03.pdf', FixtureUsers::ENTREPRENEUR_AMINE, UserRole::ENTREPRENEUR, '2026-03-01', '2026-03-31');

        $previsionnel = AccountingDocument::external($agrisense, 'Prévisionnel financier 2026-2028', DocumentType::FINANCIAL_FORECAST,
            FixtureUsers::ENTREPRENEUR_AMINE, UserRole::ENTREPRENEUR, 'FIN-PREV-2026-0042', 'financial-service');
        $previsionnel->setPeriod(new \DateTimeImmutable('2026-01-01'), new \DateTimeImmutable('2028-12-31'));
        $manager->persist($previsionnel);

        // Version 1 rejetée puis version 2 en attente
        $facturesV1 = $this->upload($agrisense, 'Factures fournisseurs T1 2026', DocumentType::INVOICE, 'factures-t1-2026.pdf', FixtureUsers::ENTREPRENEUR_AMINE, UserRole::ENTREPRENEUR, '2026-01-01', '2026-03-31');
        $this->decide($facturesV1, $sonia, ValidationDecision::REJECTED, 'Il manque les factures de février (fournisseur Hydrotech).');
        $facturesV2 = $this->upload($agrisense, 'Factures fournisseurs T1 2026 (complètes)', DocumentType::INVOICE, 'factures-t1-2026-v2.pdf', FixtureUsers::ENTREPRENEUR_AMINE, UserRole::ENTREPRENEUR, '2026-01-01', '2026-03-31');
        $facturesV2->replaces($facturesV1);

        // Document du comptable : validé d'office
        $rapport = $this->upload($agrisense, 'Rapport de revue comptable T1 2026', DocumentType::REPORT, 'rapport-revue-t1-2026.pdf', FixtureUsers::ACCOUNTANT_SONIA, UserRole::ACCOUNTANT, '2026-01-01', '2026-03-31');

        // Document supprimé logiquement par l'entrepreneur (erreur de dépôt)
        $doublon = $this->upload($agrisense, 'Relevé bancaire — mars 2026 (doublon)', DocumentType::BANK_STATEMENT, 'releve-doublon.pdf', FixtureUsers::ENTREPRENEUR_AMINE, UserRole::ENTREPRENEUR, '2026-03-01', '2026-03-31');
        $doublon->softDelete();
        $manager->persist(new DocumentEvent($doublon, DocumentEventType::DELETED, FixtureUsers::ENTREPRENEUR_AMINE, UserRole::ENTREPRENEUR, 'Déposé deux fois par erreur.'));

        $this->message($agrisense, FixtureUsers::ENTREPRENEUR_AMINE, UserRole::ENTREPRENEUR, 'Bonjour Madame Ben Ammar, je viens de déposer le bilan 2025 et le relevé de mars.', read: true);
        $this->message($agrisense, FixtureUsers::ACCOUNTANT_SONIA, UserRole::ACCOUNTANT, 'Merci Amine. Le bilan est validé. Pour les factures du T1, il manque celles de février.', $facturesV1, read: true);
        $this->message($agrisense, FixtureUsers::ENTREPRENEUR_AMINE, UserRole::ENTREPRENEUR, 'C\'est corrigé, j\'ai déposé une version complète.', $facturesV2);
        $this->message($agrisense, FixtureUsers::ACCOUNTANT_SONIA, UserRole::ACCOUNTANT, 'Parfait, je regarde cela cette semaine. Vous trouverez aussi mon rapport de revue du T1.', $rapport);

        // --- Demande en attente : MediConnect (Leïla) chez Sonia ------------------------
        $mediPending = $this->file(FixtureUsers::FILE_MEDICONNECT_PENDING, $sonia, FixtureUsers::ENTREPRENEUR_LEILA, 'Leïla Haddad',
            'MediConnect', 'prj-mediconnect-007',
            'Plateforme de téléconsultation en cours d\'immatriculation (SAS). Besoin d\'aide pour la TVA et le prévisionnel.');
        $this->message($mediPending, FixtureUsers::ENTREPRENEUR_LEILA, UserRole::ENTREPRENEUR, 'Bonjour, êtes-vous disponible pour un premier échange la semaine prochaine ?');

        // --- Dossier réaffecté : ÉcoLivraison (Thomas), Youssef -> Karim ----------------
        $eco = $this->file(FixtureUsers::FILE_ECOLIVRAISON, $youssef, FixtureUsers::ENTREPRENEUR_THOMAS, 'Thomas Moreau',
            'ÉcoLivraison', null, 'Livraison urbaine à vélo cargo à Lyon, 4 salariés.');
        $this->accept($eco, $youssef);
        $youssef->setActive(false);
        $eco->assignTo($karim);
        $manager->persist(new ClientFileAssignment($eco, AssignmentType::ADMIN_REASSIGNMENT, FixtureUsers::ACCOUNTANT_YOUSSEF,
            FixtureUsers::ACCOUNTANT_KARIM, FixtureUsers::ADMIN_NADIA, 'Espace de M. Mansouri désactivé (départ du cabinet).'));
        $this->upload($eco, 'Déclaration de TVA — T1 2026', DocumentType::TAX_RETURN, 'tva-t1-2026.pdf', FixtureUsers::ENTREPRENEUR_THOMAS, UserRole::ENTREPRENEUR, '2026-01-01', '2026-03-31');
        $this->upload($eco, 'Journal de paie — mars 2026', DocumentType::PAYROLL, 'paie-2026-03.pdf', FixtureUsers::ENTREPRENEUR_THOMAS, UserRole::ENTREPRENEUR, '2026-03-01', '2026-03-31');
        $this->message($eco, FixtureUsers::ACCOUNTANT_KARIM, UserRole::ACCOUNTANT, 'Bonjour Thomas, je reprends votre dossier suite au départ de M. Mansouri.');

        // --- Demande refusée : MediConnect chez Karim ------------------------------------
        $mediRejected = $this->file(FixtureUsers::FILE_MEDICONNECT_REJECTED, $karim, FixtureUsers::ENTREPRENEUR_LEILA, 'Leïla Haddad',
            'MediConnect', 'prj-mediconnect-007', 'Demande d\'accompagnement pour la création de la SAS.');
        $mediRejected->reject('Je ne prends plus de nouveaux dossiers dans le secteur de la santé ce trimestre.');

        // --- Dossier clôturé : AgriSense Export (Amine) chez Karim -------------------------
        $export = $this->file(FixtureUsers::FILE_AGRISENSE_EXPORT_CLOSED, $karim, FixtureUsers::ENTREPRENEUR_AMINE, 'Amine Jaziri',
            'AgriSense Export', 'prj-agrisense-export-002', 'Filiale d\'export vers le Maghreb.');
        $this->accept($export, $karim);
        $this->upload($export, 'Comptes annuels 2025', DocumentType::INCOME_STATEMENT, 'comptes-annuels-2025.pdf', FixtureUsers::ACCOUNTANT_KARIM, UserRole::ACCOUNTANT, '2025-01-01', '2025-12-31');
        $export->close();

        // --- Demande en attente chez Claire (espace fermé aux nouvelles demandes depuis) ---
        $this->file(FixtureUsers::FILE_BOULANGERIE_PENDING_CLAIRE, $claire, FixtureUsers::ENTREPRENEUR_THOMAS, 'Thomas Moreau',
            'Le Fournil Solidaire', null, 'Boulangerie coopérative en création à Villeurbanne.');

        $manager->flush();
    }

    private function workspace(string $accountantId, string $name, bool $accepting): AccountantWorkspace
    {
        $workspace = new AccountantWorkspace($accountantId, $name);
        $workspace->setAcceptingClients($accepting);
        $this->manager->persist($workspace);

        return $workspace;
    }

    private function file(string $reference, AccountantWorkspace $workspace, string $entrepreneurId, string $entrepreneurName, string $startupName, ?string $startupId, string $requestMessage): ClientFile
    {
        $file = new ClientFile($reference, $workspace, $entrepreneurId, $startupName, $startupId, $requestMessage, $entrepreneurName);
        $this->manager->persist($file);

        return $file;
    }

    private function accept(ClientFile $file, AccountantWorkspace $workspace): void
    {
        $file->activate();
        $this->manager->persist(new ClientFileAssignment($file, AssignmentType::ACCEPTANCE, null,
            $workspace->getAccountantId(), $workspace->getAccountantId()));
    }

    private function upload(ClientFile $file, string $title, DocumentType $type, string $filename, string $uploadedBy, UserRole $role, string $periodStart, string $periodEnd): AccountingDocument
    {
        $content = $this->pdf($title);
        $temp = (new Filesystem())->tempnam(sys_get_temp_dir(), 'fixture_');
        file_put_contents($temp, $content);

        $key = $this->storage->store(new \SplFileInfo($temp), $file->getId()->toRfc4122(), 'pdf');
        unlink($temp);

        $document = AccountingDocument::uploaded($file, $title, $type, $uploadedBy, $role, $key, $filename,
            'application/pdf', \strlen($content), hash('sha256', $content));
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

    private function decide(AccountingDocument $document, AccountantWorkspace $workspace, ValidationDecision $decision, string $comment): void
    {
        $this->manager->persist(new Validation($document, $workspace->getAccountantId(), $decision, $document->getStatus(), $comment));
        $document->changeStatus($decision->toDocumentStatus());
    }

    private function message(ClientFile $file, string $senderId, UserRole $role, string $content, ?AccountingDocument $document = null, bool $read = false): void
    {
        $message = new Message($file, $senderId, $role, $content, $document);
        if ($read) {
            $message->markAsRead();
        }
        $this->manager->persist($message);
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
