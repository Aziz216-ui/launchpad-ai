<?php

namespace App\DataFixtures;

use App\Entity\ClientFile;
use App\Entity\ClientFileAssignment;
use App\Enum\AssignmentType;
use App\Remote\WorkspaceInfo;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;
use Launchpad\Common\Fixtures\FixtureCatalog;
use Launchpad\Common\Fixtures\FixtureUsers;

/**
 * Dossiers de démonstration dans tous les statuts, avec leur historique d'affectation.
 * Les espaces et les identifiants viennent du catalogue partagé (FixtureCatalog).
 */
final class AppFixtures extends Fixture
{
    private ObjectManager $manager;

    public function load(ObjectManager $manager): void
    {
        $this->manager = $manager;
        $sonia = $this->workspace(FixtureCatalog::WORKSPACE_SONIA);
        $karim = $this->workspace(FixtureCatalog::WORKSPACE_KARIM);
        $claire = $this->workspace(FixtureCatalog::WORKSPACE_CLAIRE);
        $youssef = $this->workspace(FixtureCatalog::WORKSPACE_YOUSSEF);

        // --- Dossier actif complet : AgriSense (Amine) suivi par Sonia ---------------
        $agrisense = $this->file(FixtureCatalog::FILE_AGRISENSE, FixtureUsers::FILE_AGRISENSE, $sonia, FixtureUsers::ENTREPRENEUR_AMINE, 'Amine Jaziri',
            'AgriSense', 'prj-agrisense-001',
            'Bonjour, nous lançons une solution de capteurs connectés pour l\'irrigation. Nous cherchons un accompagnement pour notre premier exercice.');
        $this->accept($agrisense, $sonia);

        // --- Demande en attente : MediConnect (Leïla) chez Sonia ------------------------
        $this->file(FixtureCatalog::FILE_MEDICONNECT_PENDING, FixtureUsers::FILE_MEDICONNECT_PENDING, $sonia, FixtureUsers::ENTREPRENEUR_LEILA, 'Leïla Haddad',
            'MediConnect', 'prj-mediconnect-007',
            'Plateforme de téléconsultation en cours d\'immatriculation (SAS). Besoin d\'aide pour la TVA et le prévisionnel.');

        // --- Dossier réaffecté : ÉcoLivraison (Thomas), Youssef -> Karim ----------------
        $eco = $this->file(FixtureCatalog::FILE_ECOLIVRAISON, FixtureUsers::FILE_ECOLIVRAISON, $youssef, FixtureUsers::ENTREPRENEUR_THOMAS, 'Thomas Moreau',
            'ÉcoLivraison', null, 'Livraison urbaine à vélo cargo à Lyon, 4 salariés.');
        $this->accept($eco, $youssef);
        $eco->assignTo($karim);
        $manager->persist(new ClientFileAssignment($eco, AssignmentType::ADMIN_REASSIGNMENT, FixtureUsers::ACCOUNTANT_YOUSSEF,
            FixtureUsers::ACCOUNTANT_KARIM, FixtureUsers::ADMIN_NADIA, 'Espace de M. Mansouri désactivé (départ du cabinet).'));

        // --- Demande refusée : MediConnect chez Karim ------------------------------------
        $mediRejected = $this->file(FixtureCatalog::FILE_MEDICONNECT_REJECTED, FixtureUsers::FILE_MEDICONNECT_REJECTED, $karim, FixtureUsers::ENTREPRENEUR_LEILA, 'Leïla Haddad',
            'MediConnect', 'prj-mediconnect-007', 'Demande d\'accompagnement pour la création de la SAS.');
        $mediRejected->reject('Je ne prends plus de nouveaux dossiers dans le secteur de la santé ce trimestre.');

        // --- Dossier clôturé : AgriSense Export (Amine) chez Karim -------------------------
        $export = $this->file(FixtureCatalog::FILE_AGRISENSE_EXPORT_CLOSED, FixtureUsers::FILE_AGRISENSE_EXPORT_CLOSED, $karim, FixtureUsers::ENTREPRENEUR_AMINE, 'Amine Jaziri',
            'AgriSense Export', 'prj-agrisense-export-002', 'Filiale d\'export vers le Maghreb.');
        $this->accept($export, $karim);
        $export->close();

        // --- Demande en attente chez Claire (espace fermé aux nouvelles demandes depuis) ---
        $this->file(FixtureCatalog::FILE_BOULANGERIE_PENDING_CLAIRE, FixtureUsers::FILE_BOULANGERIE_PENDING_CLAIRE, $claire, FixtureUsers::ENTREPRENEUR_THOMAS, 'Thomas Moreau',
            'Le Fournil Solidaire', null, 'Boulangerie coopérative en création à Villeurbanne.');

        $manager->flush();
    }

    private function workspace(string $id): WorkspaceInfo
    {
        $data = FixtureCatalog::WORKSPACES[$id];

        return new WorkspaceInfo($id, $data['accountantId'], $data['displayName'], $data['acceptingClients'], $data['active']);
    }

    private function file(string $id, string $reference, WorkspaceInfo $workspace, string $entrepreneurId, string $entrepreneurName, string $startupName, ?string $startupId, string $requestMessage): ClientFile
    {
        $file = new ClientFile($reference, $workspace, $entrepreneurId, $startupName, $startupId, $requestMessage, $entrepreneurName);
        FixtureCatalog::forceId($file, $id);
        $this->manager->persist($file);

        return $file;
    }

    private function accept(ClientFile $file, WorkspaceInfo $workspace): void
    {
        $file->activate();
        $this->manager->persist(new ClientFileAssignment($file, AssignmentType::ACCEPTANCE, null,
            $workspace->accountantId, $workspace->accountantId));
    }
}
