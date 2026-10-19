<?php

namespace App\Service;

use App\Entity\AccountantWorkspace;
use App\Exception\ApiException;
use App\Repository\AccountantWorkspaceRepository;
use App\Repository\ClientFileRepository;
use App\Security\KeycloakUser;
use Doctrine\ORM\EntityManagerInterface;

final class WorkspaceService
{
    public const DEACTIVATION_REASON = 'Espace comptable désactivé';

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly AccountantWorkspaceRepository $workspaces,
        private readonly ClientFileRepository $files,
    ) {
    }

    /**
     * Crée l'espace du comptable à sa première requête (acceptingClients = false)
     * et rafraîchit son nom d'affichage depuis le jeton.
     */
    public function provision(KeycloakUser $accountant): AccountantWorkspace
    {
        $workspace = $this->workspaces->findOneByAccountantId($accountant->getId());

        if (null === $workspace) {
            $workspace = new AccountantWorkspace($accountant->getId(), $accountant->getDisplayName());
            $this->em->persist($workspace);
            $this->em->flush();
        } elseif ($workspace->getDisplayName() !== $accountant->getDisplayName()) {
            $workspace->setDisplayName($accountant->getDisplayName());
            $this->em->flush();
        }

        return $workspace;
    }

    public function setAcceptingClients(AccountantWorkspace $workspace, bool $acceptingClients): void
    {
        if (!$workspace->isActive()) {
            throw ApiException::conflict('WORKSPACE_INACTIVE', 'Votre espace a été désactivé par un administrateur.');
        }

        $workspace->setAcceptingClients($acceptingClients);
        $this->em->flush();
    }

    /**
     * Activation / désactivation par un administrateur. À la désactivation, les demandes
     * en attente sont refusées automatiquement pour que l'entrepreneur choisisse un autre comptable ;
     * les dossiers actifs restent lisibles et doivent être réaffectés.
     *
     * @return int nombre de demandes refusées automatiquement
     */
    public function setActive(AccountantWorkspace $workspace, bool $active): int
    {
        $rejected = 0;

        if ($workspace->isActive() && !$active) {
            foreach ($this->files->findPendingByWorkspace($workspace) as $file) {
                $file->reject(self::DEACTIVATION_REASON);
                ++$rejected;
            }
        }

        $workspace->setActive($active);
        $this->em->flush();

        return $rejected;
    }
}
