<?php

namespace App\Internal;

use App\Entity\AccountantWorkspace;
use App\Presenter\ApiPresenter;
use Launchpad\Common\Http\ApiResponse;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\Requirement\Requirement;

/**
 * Routes internes (clé X-Internal-Key) : lecture d'un espace par client-file-service
 * lors d'une demande de dossier ou d'une affectation.
 */
final class WorkspaceInternalController
{
    public function __construct(private readonly ApiPresenter $presenter)
    {
    }

    #[Route('/workspaces/{id}', name: 'internal_workspace_show', requirements: ['id' => Requirement::UUID], methods: ['GET'])]
    public function show(AccountantWorkspace $workspace): JsonResponse
    {
        return ApiResponse::data($this->presenter->workspace($workspace));
    }
}
