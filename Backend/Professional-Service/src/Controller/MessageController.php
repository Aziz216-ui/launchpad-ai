<?php

namespace App\Controller;

use App\Dto\SendMessageRequest;
use App\Entity\ClientFile;
use App\Entity\Message;
use App\Http\ApiResponse;
use App\Http\Pagination\Paginator;
use App\Presenter\ApiPresenter;
use App\Repository\MessageRepository;
use App\Security\KeycloakUser;
use App\Security\Voter\ClientFileVoter;
use App\Security\Voter\MessageVoter;
use App\Service\MessageService;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\Requirement\Requirement;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

final class MessageController
{
    public function __construct(
        private readonly MessageService $service,
        private readonly MessageRepository $messages,
        private readonly ApiPresenter $presenter,
        private readonly Paginator $paginator,
    ) {
    }

    /** Fil de discussion du dossier, du plus récent au plus ancien. */
    #[Route('/files/{id}/messages', name: 'message_list', requirements: ['id' => Requirement::UUID], methods: ['GET'])]
    #[IsGranted(ClientFileVoter::VIEW, subject: 'file')]
    public function list(ClientFile $file, Request $request): JsonResponse
    {
        return ApiResponse::page($this->paginator->paginate(
            $this->messages->createByClientFileQuery($file),
            $request,
            $this->presenter->message(...),
        ));
    }

    #[Route('/files/{id}/messages', name: 'message_send', requirements: ['id' => Requirement::UUID], methods: ['POST'])]
    #[IsGranted(ClientFileVoter::SEND_MESSAGE, subject: 'file')]
    public function send(ClientFile $file, #[MapRequestPayload] SendMessageRequest $request, #[CurrentUser] KeycloakUser $user): JsonResponse
    {
        $message = $this->service->send($file, $request, $user);

        return ApiResponse::data($this->presenter->message($message), Response::HTTP_CREATED);
    }

    #[Route('/messages/{id}/read', name: 'message_read', requirements: ['id' => Requirement::UUID], methods: ['POST'])]
    #[IsGranted(MessageVoter::MARK_READ, subject: 'message')]
    public function markAsRead(Message $message): JsonResponse
    {
        $this->service->markAsRead($message);

        return ApiResponse::data($this->presenter->message($message));
    }
}
