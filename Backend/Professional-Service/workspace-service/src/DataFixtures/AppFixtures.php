<?php

namespace App\DataFixtures;

use App\Entity\AccountantWorkspace;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;
use Launchpad\Common\Fixtures\FixtureCatalog;

/**
 * Espaces comptables de démonstration (identifiants partagés avec les autres services).
 */
final class AppFixtures extends Fixture
{
    public function load(ObjectManager $manager): void
    {
        foreach (FixtureCatalog::WORKSPACES as $id => $data) {
            $workspace = new AccountantWorkspace($data['accountantId'], $data['displayName']);
            FixtureCatalog::forceId($workspace, $id);
            $workspace->setAcceptingClients($data['acceptingClients']);
            $workspace->setActive($data['active']);
            $manager->persist($workspace);
        }

        $manager->flush();
    }
}
