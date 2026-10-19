<?php

namespace App\Controller;

use App\Enum\UserRole;
use App\Http\ApiResponse;
use App\Presenter\ApiPresenter;
use App\Repository\AccountantWorkspaceRepository;
use App\Security\KeycloakUser;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

final class MeController
{
    public function __construct(
        private readonly ApiPresenter $presenter,
        private readonly AccountantWorkspaceRepository $workspaces,
    ) {
    }

    /** Identité lue dans le jeton (claims Keycloak) et rôles reconnus par le service. */
    #[Route('/me', name: 'me', methods: ['GET'])]
    public function __invoke(#[CurrentUser] KeycloakUser $user): JsonResponse
    {
        $workspace = $user->hasRole(UserRole::ACCOUNTANT) ? $this->workspaces->findOneByAccountantId($user->getId()) : null;

        return ApiResponse::data($this->presenter->user($user, $workspace));
    }
}
