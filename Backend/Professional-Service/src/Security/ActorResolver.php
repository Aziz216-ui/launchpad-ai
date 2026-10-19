<?php

namespace App\Security;

use App\Entity\ClientFile;
use App\Enum\UserRole;

/**
 * Détermine à quel titre un utilisateur intervient sur un dossier.
 */
final class ActorResolver
{
    public function isOwner(KeycloakUser $user, ClientFile $file): bool
    {
        return $user->hasRole(UserRole::ENTREPRENEUR) && $file->getEntrepreneurId() === $user->getId();
    }

    /** Comptable actuellement affecté (ou visé par la demande). */
    public function isAssignedAccountant(KeycloakUser $user, ClientFile $file): bool
    {
        return $user->hasRole(UserRole::ACCOUNTANT) && $file->getWorkspace()->getAccountantId() === $user->getId();
    }

    /** Comptable affecté dont l'espace est actif : seul cas où il peut agir. */
    public function isActingAccountant(KeycloakUser $user, ClientFile $file): bool
    {
        return $this->isAssignedAccountant($user, $file) && $file->getWorkspace()->isActive();
    }

    public function roleInFile(KeycloakUser $user, ClientFile $file): ?UserRole
    {
        return match (true) {
            $this->isOwner($user, $file) => UserRole::ENTREPRENEUR,
            $this->isAssignedAccountant($user, $file) => UserRole::ACCOUNTANT,
            $user->hasRole(UserRole::ADMIN) => UserRole::ADMIN,
            default => null,
        };
    }
}
