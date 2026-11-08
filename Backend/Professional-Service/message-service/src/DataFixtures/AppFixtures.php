<?php

namespace App\DataFixtures;

use App\Entity\Message;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;
use Launchpad\Common\Enum\UserRole;
use Launchpad\Common\Fixtures\FixtureCatalog;
use Launchpad\Common\Fixtures\FixtureUsers;

/**
 * Fils de discussion de démonstration. Dossiers et documents cités : catalogue partagé (FixtureCatalog).
 */
final class AppFixtures extends Fixture
{
    private ObjectManager $manager;

    public function load(ObjectManager $manager): void
    {
        $this->manager = $manager;

        // --- AgriSense (Amine) avec Sonia ---------------------------------------------------
        $agrisense = FixtureCatalog::FILE_AGRISENSE;
        $this->message($agrisense, FixtureUsers::ENTREPRENEUR_AMINE, UserRole::ENTREPRENEUR, 'Bonjour Madame Ben Ammar, je viens de déposer le bilan 2025 et le relevé de mars.', read: true);
        $this->message($agrisense, FixtureUsers::ACCOUNTANT_SONIA, UserRole::ACCOUNTANT, 'Merci Amine. Le bilan est validé. Pour les factures du T1, il manque celles de février.', FixtureCatalog::DOC_FACTURES_V1, read: true);
        $this->message($agrisense, FixtureUsers::ENTREPRENEUR_AMINE, UserRole::ENTREPRENEUR, 'C\'est corrigé, j\'ai déposé une version complète.', FixtureCatalog::DOC_FACTURES_V2);
        $this->message($agrisense, FixtureUsers::ACCOUNTANT_SONIA, UserRole::ACCOUNTANT, 'Parfait, je regarde cela cette semaine. Vous trouverez aussi mon rapport de revue du T1.', FixtureCatalog::DOC_RAPPORT);

        // --- Demande en attente : MediConnect (Leïla) chez Sonia ----------------------------
        $this->message(FixtureCatalog::FILE_MEDICONNECT_PENDING, FixtureUsers::ENTREPRENEUR_LEILA, UserRole::ENTREPRENEUR, 'Bonjour, êtes-vous disponible pour un premier échange la semaine prochaine ?');

        // --- ÉcoLivraison (Thomas), repris par Karim -----------------------------------------
        $this->message(FixtureCatalog::FILE_ECOLIVRAISON, FixtureUsers::ACCOUNTANT_KARIM, UserRole::ACCOUNTANT, 'Bonjour Thomas, je reprends votre dossier suite au départ de M. Mansouri.');

        $manager->flush();
    }

    private function message(string $fileId, string $senderId, UserRole $role, string $content, ?string $documentId = null, bool $read = false): void
    {
        $message = new Message($fileId, $senderId, $role, $content, $documentId);
        if ($read) {
            $message->markAsRead();
        }
        $this->manager->persist($message);
    }
}
