<?php

namespace App\Controller;

use App\Dto\SendMessageRequest;
use App\Entity\Message;
use App\Presenter\ApiPresenter;
use App\Repository\MessageRepository;
use App\Security\Voter\MessageVoter;
use App\Service\MessageService;
use Launchpad\Common\Enum\UserRole;
use Launchpad\Common\Http\ApiResponse;
use Launchpad\Common\Http\Pagination\Paginator;
use Launchpad\Common\Remote\ClientFileDirectory;
use Launchpad\Common\Remote\Model\FileContext;
use Launchpad\Common\Security\KeycloakUser;
use Launchpad\Common\Security\Voter\FileContextVoter;
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
        private readonly ClientFileDirectory $files,
    ) {
    }

    /**
     * Centre de notifications : messages non lus de l'utilisateur dans tous ses dossiers
     * (messages de l'autre participant et notifications automatiques), le plus récent d'abord.
     * Chaque message porte la référence et le nom de la startup de son dossier.
     */
    #[Route('/messages/unread', name: 'message_unread', methods: ['GET'], priority: 10)]
    public function unread(Request $request, #[CurrentUser] KeycloakUser $user): JsonResponse
    {
        $accountant = $user->hasRole(UserRole::ACCOUNTANT);
        $files = [];
        if ($accountant || $user->hasRole(UserRole::ENTREPRENEUR)) {
            foreach ($this->files->participantFiles($user->getId(), $accountant) as $file) {
                $files[$file->id] = $file;
            }
        }
        if ([] === $files) {
            return ApiResponse::page(['data' => [], 'meta' => ['page' => 1, 'limit' => 20, 'total' => 0, 'pages' => 0]]);
        }

        return ApiResponse::page($this->paginator->paginate(
            $this->messages->createUnreadQuery(array_keys($files), $user->getId()),
            $request,
            function (Message $message) use ($files): array {
                $file = $files[$message->getClientFileId()->toRfc4122()];

                return $this->presenter->message($message) + [
                    'file' => ['id' => $file->id, 'reference' => $file->reference, 'startupName' => $file->startupName],
                ];
            },
        ));
    }

    /** Fil de discussion du dossier, du plus récent au plus ancien. */
    #[Route('/files/{id}/messages', name: 'message_list', requirements: ['id' => Requirement::UUID], methods: ['GET'])]
    #[IsGranted(FileContextVoter::VIEW, subject: 'file')]
    public function list(FileContext $file, Request $request): JsonResponse
    {
        return ApiResponse::page($this->paginator->paginate(
            $this->messages->createByClientFileQuery($file->id),
            $request,
            $this->presenter->message(...),
        ));
    }

    #[Route('/files/{id}/messages', name: 'message_send', requirements: ['id' => Requirement::UUID], methods: ['POST'])]
    #[IsGranted(FileContextVoter::SEND_MESSAGE, subject: 'file')]
    public function send(FileContext $file, #[MapRequestPayload] SendMessageRequest $request, #[CurrentUser] KeycloakUser $user): JsonResponse
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
