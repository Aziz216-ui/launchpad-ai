<?php

namespace App\Controller;

use App\Dto\UpdateAcceptingClientsRequest;
use App\Dto\UpdateWorkspaceStatusRequest;
use App\Entity\AccountantWorkspace;
use App\Presenter\ApiPresenter;
use App\Repository\AccountantWorkspaceRepository;
use App\Service\WorkspaceService;
use Launchpad\Common\Enum\UserRole;
use Launchpad\Common\Http\ApiResponse;
use Launchpad\Common\Http\Pagination\Paginator;
use Launchpad\Common\Security\KeycloakUser;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\Requirement\Requirement;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/workspaces')]
final class WorkspaceController
{
    public function __construct(
        private readonly WorkspaceService $service,
        private readonly AccountantWorkspaceRepository $workspaces,
        private readonly ApiPresenter $presenter,
        private readonly Paginator $paginator,
    ) {
    }

    /**
     * Annuaire des comptables disponibles (actifs et acceptant des clients).
     * Un administrateur peut lister tous les espaces avec ?all=true.
     */
    #[Route('', name: 'workspace_list', methods: ['GET'])]
    public function list(Request $request, #[CurrentUser] KeycloakUser $user): JsonResponse
    {
        $all = $user->hasRole(UserRole::ADMIN) && $request->query->getBoolean('all');

        return ApiResponse::page($this->paginator->paginate(
            $this->workspaces->createListQuery(onlyAvailable: !$all),
            $request,
            $this->presenter->workspace(...),
        ));
    }

    #[Route('/me', name: 'workspace_me', methods: ['GET'])]
    #[IsGranted('ROLE_ACCOUNTANT')]
    public function me(#[CurrentUser] KeycloakUser $user): JsonResponse
    {
        return ApiResponse::data($this->presenter->workspace($this->service->provision($user)));
    }

    /** Le comptable ouvre ou ferme son espace aux nouvelles demandes. */
    #[Route('/me', name: 'workspace_me_update', methods: ['PATCH'])]
    #[IsGranted('ROLE_ACCOUNTANT')]
    public function updateMe(#[CurrentUser] KeycloakUser $user, #[MapRequestPayload] UpdateAcceptingClientsRequest $request): JsonResponse
    {
        $workspace = $this->service->provision($user);
        $this->service->setAcceptingClients($workspace, $request->acceptingClients);

        return ApiResponse::data($this->presenter->workspace($workspace));
    }

    /**
     * Activation / désactivation d'un espace par un administrateur.
     * Les dossiers de l'espace sont mis à jour de façon asynchrone par client-file-service (RabbitMQ).
     */
    #[Route('/{id}/status', name: 'workspace_status', requirements: ['id' => Requirement::UUID], methods: ['PATCH'])]
    #[IsGranted('ROLE_ADMIN')]
    public function updateStatus(AccountantWorkspace $workspace, #[MapRequestPayload] UpdateWorkspaceStatusRequest $request, #[CurrentUser] KeycloakUser $admin): JsonResponse
    {
        $this->service->setActive($workspace, $request->active, $admin);

        return ApiResponse::data($this->presenter->workspace($workspace));
    }
}
