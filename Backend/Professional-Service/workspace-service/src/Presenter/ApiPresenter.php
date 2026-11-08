<?php

namespace App\Presenter;

use App\Entity\AccountantWorkspace;
use Launchpad\Common\Security\KeycloakUser;

/**
 * Représentation JSON des ressources de l'API (contrat explicite, indépendant des entités).
 */
final class ApiPresenter
{
    /**
     * @return array<string, mixed>
     */
    public function user(KeycloakUser $user, ?AccountantWorkspace $workspace): array
    {
        return [
            'id' => $user->getId(),
            'username' => $user->getUsername(),
            'email' => $user->getEmail(),
            'firstName' => $user->getFirstName(),
            'lastName' => $user->getLastName(),
            'displayName' => $user->getDisplayName(),
            'roles' => $user->getRoles(),
            'workspaceId' => $workspace?->getId()->toRfc4122(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function workspace(AccountantWorkspace $workspace): array
    {
        return [
            'id' => $workspace->getId()->toRfc4122(),
            'accountantId' => $workspace->getAccountantId(),
            'displayName' => $workspace->getDisplayName(),
            'acceptingClients' => $workspace->isAcceptingClients(),
            'active' => $workspace->isActive(),
            'createdAt' => $workspace->getCreatedAt()->format(\DateTimeInterface::ATOM),
            'updatedAt' => $workspace->getUpdatedAt()->format(\DateTimeInterface::ATOM),
        ];
    }
}
