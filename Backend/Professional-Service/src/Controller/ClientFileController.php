<?php

namespace App\Controller;

use App\Dto\AssignClientFileRequest;
use App\Dto\CreateClientFileRequest;
use App\Dto\RejectClientFileRequest;
use App\Dto\UpdateClientFileRequest;
use App\Entity\ClientFile;
use App\Enum\ClientFileStatus;
use App\Enum\UserRole;
use App\Http\ApiResponse;
use App\Http\Pagination\Paginator;
use App\Http\QueryParams;
use App\Presenter\ApiPresenter;
use App\Repository\ClientFileAssignmentRepository;
use App\Repository\ClientFileRepository;
use App\Security\KeycloakUser;
use App\Security\Voter\ClientFileVoter;
use App\Service\ClientFileService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Routing\Requirement\Requirement;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/files')]
final class ClientFileController
{
    public function __construct(
        private readonly ClientFileService $service,
        private readonly ClientFileRepository $files,
        private readonly ClientFileAssignmentRepository $assignments,
        private readonly ApiPresenter $presenter,
        private readonly Paginator $paginator,
        private readonly UrlGeneratorInterface $urlGenerator,
    ) {
    }

    /**
     * Dossiers visibles par l'utilisateur : tous (admin), ceux qui lui sont affectés (comptable)
     * ou les siens (entrepreneur). Filtre facultatif ?status=PENDING|ACTIVE|REJECTED|CLOSED.
     */
    #[Route('', name: 'file_list', methods: ['GET'])]
    public function list(Request $request, #[CurrentUser] KeycloakUser $user): JsonResponse
    {
        $status = QueryParams::enum($request, 'status', ClientFileStatus::class);

        $query = match (true) {
            $user->hasRole(UserRole::ADMIN) => $this->files->createFilteredQuery(status: $status),
            $user->hasRole(UserRole::ACCOUNTANT) => $this->files->createFilteredQuery(accountantId: $user->getId(), status: $status),
            default => $this->files->createFilteredQuery(entrepreneurId: $user->getId(), status: $status),
        };

        return ApiResponse::page($this->paginator->paginate($query, $request, $this->presenter->clientFile(...)));
    }

    /** L'entrepreneur demande un comptable : le dossier est créé en PENDING. */
    #[Route('', name: 'file_create', methods: ['POST'])]
    #[IsGranted('ROLE_ENTREPRENEUR')]
    public function create(#[MapRequestPayload] CreateClientFileRequest $request, #[CurrentUser] KeycloakUser $user): JsonResponse
    {
        $file = $this->service->create($request, $user);

        $response = ApiResponse::data($this->presenter->clientFile($file), Response::HTTP_CREATED);
        $response->headers->set('Location', $this->urlGenerator->generate('file_show', ['id' => $file->getId()->toRfc4122()]));

        return $response;
    }

    #[Route('/{id}', name: 'file_show', requirements: ['id' => Requirement::UUID], methods: ['GET'])]
    #[IsGranted(ClientFileVoter::VIEW, subject: 'file')]
    public function show(ClientFile $file): JsonResponse
    {
        return ApiResponse::data($this->presenter->clientFile($file));
    }

    #[Route('/{id}', name: 'file_update', requirements: ['id' => Requirement::UUID], methods: ['PATCH'])]
    #[IsGranted(ClientFileVoter::UPDATE, subject: 'file')]
    public function update(ClientFile $file, #[MapRequestPayload] UpdateClientFileRequest $request): JsonResponse
    {
        $this->service->update($file, $request);

        return ApiResponse::data($this->presenter->clientFile($file));
    }

    #[Route('/{id}/accept', name: 'file_accept', requirements: ['id' => Requirement::UUID], methods: ['POST'])]
    #[IsGranted(ClientFileVoter::ACCEPT, subject: 'file')]
    public function accept(ClientFile $file, #[CurrentUser] KeycloakUser $user): JsonResponse
    {
        $this->service->accept($file, $user);

        return ApiResponse::data($this->presenter->clientFile($file));
    }

    #[Route('/{id}/reject', name: 'file_reject', requirements: ['id' => Requirement::UUID], methods: ['POST'])]
    #[IsGranted(ClientFileVoter::REJECT, subject: 'file')]
    public function reject(ClientFile $file, #[MapRequestPayload] RejectClientFileRequest $request): JsonResponse
    {
        $this->service->reject($file, $request->reason);

        return ApiResponse::data($this->presenter->clientFile($file));
    }

    /** Affectation directe (demande en attente) ou réaffectation (dossier actif) par un administrateur. */
    #[Route('/{id}/assign', name: 'file_assign', requirements: ['id' => Requirement::UUID], methods: ['POST'])]
    #[IsGranted(ClientFileVoter::ASSIGN, subject: 'file')]
    public function assign(ClientFile $file, #[MapRequestPayload] AssignClientFileRequest $request, #[CurrentUser] KeycloakUser $user): JsonResponse
    {
        $this->service->assign($file, $request, $user);

        return ApiResponse::data($this->presenter->clientFile($file));
    }

    #[Route('/{id}/close', name: 'file_close', requirements: ['id' => Requirement::UUID], methods: ['POST'])]
    #[IsGranted(ClientFileVoter::CLOSE, subject: 'file')]
    public function close(ClientFile $file): JsonResponse
    {
        $this->service->close($file);

        return ApiResponse::data($this->presenter->clientFile($file));
    }

    #[Route('/{id}/assignments', name: 'file_assignments', requirements: ['id' => Requirement::UUID], methods: ['GET'])]
    #[IsGranted(ClientFileVoter::VIEW, subject: 'file')]
    public function assignments(ClientFile $file, Request $request): JsonResponse
    {
        return ApiResponse::page($this->paginator->paginate(
            $this->assignments->createByClientFileQuery($file),
            $request,
            $this->presenter->assignment(...),
        ));
    }
}
