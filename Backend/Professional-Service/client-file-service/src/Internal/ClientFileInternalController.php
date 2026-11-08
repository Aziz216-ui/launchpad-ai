<?php

namespace App\Internal;

use Launchpad\Common\Http\ApiResponse;
use Launchpad\Common\Remote\Model\FileContext;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\Requirement\Requirement;

/**
 * Routes internes (clé X-Internal-Key), appelées par les autres microservices.
 * Les changements d'état des espaces comptables arrivent, eux, par RabbitMQ (WorkspaceStatusListener).
 */
final class ClientFileInternalController
{
    /** Contexte d'un dossier pour document-service et message-service (droits d'accès). */
    #[Route('/files/{id}', name: 'internal_file_context', requirements: ['id' => Requirement::UUID], methods: ['GET'])]
    public function context(FileContext $file): JsonResponse
    {
        return ApiResponse::data($file->toArray());
    }
}
