<?php

namespace Launchpad\Common\Security;

use Launchpad\Common\Enum\UserRole;
use Launchpad\Common\Remote\Model\FileContext;

/**
 * Détermine à quel titre un utilisateur intervient sur un dossier.
 */
final class ActorResolver
{
    public function isOwner(KeycloakUser $user, FileContext $file): bool
    {
        return $user->hasRole(UserRole::ENTREPRENEUR) && $file->entrepreneurId === $user->getId();
    }

    /** Comptable actuellement affecté (ou visé par la demande). */
    public function isAssignedAccountant(KeycloakUser $user, FileContext $file): bool
    {
        return $user->hasRole(UserRole::ACCOUNTANT) && $file->accountantId === $user->getId();
    }

    /** Comptable affecté dont l'espace est actif : seul cas où il peut agir. */
    public function isActingAccountant(KeycloakUser $user, FileContext $file): bool
    {
        return $this->isAssignedAccountant($user, $file) && $file->workspaceActive;
    }

    public function canView(KeycloakUser $user, FileContext $file): bool
    {
        return $user->hasRole(UserRole::ADMIN) || $this->isOwner($user, $file) || $this->isAssignedAccountant($user, $file);
    }

    public function roleInFile(KeycloakUser $user, FileContext $file): ?UserRole
    {
        return match (true) {
            $this->isOwner($user, $file) => UserRole::ENTREPRENEUR,
            $this->isAssignedAccountant($user, $file) => UserRole::ACCOUNTANT,
            $user->hasRole(UserRole::ADMIN) => UserRole::ADMIN,
            default => null,
        };
    }
}
