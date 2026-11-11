<?php

namespace App\Service;

use App\Entity\AccountantWorkspace;
use App\Repository\AccountantWorkspaceRepository;
use Doctrine\ORM\EntityManagerInterface;
use Launchpad\Common\Exception\ApiException;
use Launchpad\Common\Messaging\Message\WorkspaceStatusChanged;
use Launchpad\Common\Messaging\MessagePublisher;
use Launchpad\Common\Messaging\MessagingException;
use Launchpad\Common\Messaging\Queues;
use Launchpad\Common\Security\KeycloakUser;

final class WorkspaceService
{
    public const DEACTIVATION_REASON = 'Espace comptable désactivé';

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly AccountantWorkspaceRepository $workspaces,
        private readonly MessagePublisher $publisher,
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

    /**
     * Espace d'un comptable qui vient de s'inscrire (événement RabbitMQ de User-Service).
     * Créé ouvert aux demandes : il est visible dans l'annuaire des entrepreneurs sans attendre sa
     * première connexion. S'il existe déjà, seul le nom d'affichage est rafraîchi : un comptable qui a
     * fermé son espace, ou un espace désactivé par un administrateur, garde son état.
     *
     * @return array{0: AccountantWorkspace, 1: bool} l'espace et true s'il vient d'être créé
     */
    public function provisionRegisteredAccountant(string $accountantId, string $displayName): array
    {
        $workspace = $this->workspaces->findOneByAccountantId($accountantId);

        if (null !== $workspace) {
            if ($workspace->getDisplayName() !== $displayName) {
                $workspace->setDisplayName($displayName);
                $this->em->flush();
            }

            return [$workspace, false];
        }

        $workspace = new AccountantWorkspace($accountantId, $displayName);
        $workspace->setAcceptingClients(true);
        $this->em->persist($workspace);
        $this->em->flush();

        return [$workspace, true];
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
     * Activation / désactivation par un administrateur.
     *
     * Sauvegarde puis publication de WorkspaceStatusChanged sur RabbitMQ (communication asynchrone) :
     * client-file-service la consomme, refuse les demandes en attente de l'espace (l'entrepreneur choisit
     * un autre comptable) et passe ses dossiers actifs en lecture seule jusqu'à leur réaffectation.
     * S'il est arrêté, le message attend dans la queue durable et sera traité à son redémarrage.
     *
     * Les deux opérations sont liées dans une transaction : si RabbitMQ est injoignable, la modification
     * est annulée (503) plutôt que d'enregistrer un état que client-file-service ne connaîtra jamais.
     */
    public function setActive(AccountantWorkspace $workspace, bool $active, KeycloakUser $admin): void
    {
        if ($workspace->isActive() === $active) {
            return;
        }

        try {
            $this->em->wrapInTransaction(function () use ($workspace, $active, $admin): void {
                $workspace->setActive($active);
                $this->em->flush();

                $this->publisher->publish(Queues::CLIENT_FILE_WORKSPACE_STATUS, new WorkspaceStatusChanged(
                    workspaceId: $workspace->getId()->toRfc4122(),
                    active: $active,
                    reason: self::DEACTIVATION_REASON,
                    changedBy: $admin->getId(),
                    changedAt: (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM),
                ));
            });
        } catch (MessagingException) {
            // La transaction est annulée : l'espace garde son état d'origine
            $workspace->setActive(!$active);
            throw ApiException::serviceUnavailable('de messagerie (RabbitMQ)');
        }
    }
}
