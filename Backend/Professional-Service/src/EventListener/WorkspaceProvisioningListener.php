<?php

namespace App\EventListener;

use App\Enum\UserRole;
use App\Security\KeycloakUser;
use App\Service\WorkspaceService;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\Security\Http\Event\LoginSuccessEvent;

/**
 * Crée l'espace comptable à la première requête authentifiée d'un ROLE_ACCOUNTANT
 * (firewall stateless : l'événement est émis à chaque requête).
 */
#[AsEventListener]
final class WorkspaceProvisioningListener
{
    public function __construct(private readonly WorkspaceService $workspaces)
    {
    }

    public function __invoke(LoginSuccessEvent $event): void
    {
        $user = $event->getUser();

        if ($user instanceof KeycloakUser && $user->hasRole(UserRole::ACCOUNTANT)) {
            $this->workspaces->provision($user);
        }
    }
}
