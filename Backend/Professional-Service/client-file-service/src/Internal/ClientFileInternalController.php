<?php

namespace App\Internal;

use Launchpad\Common\Exception\ApiException;
use Launchpad\Common\Http\ApiResponse;
use Launchpad\Common\Remote\ClientFileDirectory;
use Launchpad\Common\Remote\Model\FileContext;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\Requirement\Requirement;

/**
 * Routes internes (clé X-Internal-Key), appelées par les autres microservices.
 * Les changements d'état des espaces comptables arrivent, eux, par RabbitMQ (WorkspaceStatusListener).
 */
final class ClientFileInternalController
{
    public function __construct(private readonly ClientFileDirectory $directory)
    {
    }

    /**
     * Dossiers d'un participant (?entrepreneurId= ou ?accountantId=) : message-service en déduit
     * les messages non lus de l'utilisateur (centre de notifications).
     */
    #[Route('/files', name: 'internal_participant_files', methods: ['GET'])]
    public function participantFiles(Request $request): JsonResponse
    {
        $accountantId = trim((string) $request->query->get('accountantId', ''));
        $entrepreneurId = trim((string) $request->query->get('entrepreneurId', ''));
        if ('' === $accountantId && '' === $entrepreneurId) {
            throw ApiException::badRequest('MISSING_PARTICIPANT', 'Indiquez entrepreneurId ou accountantId.');
        }
        $files = '' !== $accountantId
            ? $this->directory->participantFiles($accountantId, true)
            : $this->directory->participantFiles($entrepreneurId, false);

        return ApiResponse::data(array_map(static fn (FileContext $f): array => $f->toArray(), $files));
    }

    /** Contexte d'un dossier pour document-service et message-service (droits d'accès). */
    #[Route('/files/{id}', name: 'internal_file_context', requirements: ['id' => Requirement::UUID], methods: ['GET'])]
    public function context(FileContext $file): JsonResponse
    {
        return ApiResponse::data($file->toArray());
    }
}
