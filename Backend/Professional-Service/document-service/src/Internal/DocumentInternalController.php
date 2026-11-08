<?php

namespace App\Internal;

use App\Presenter\ApiPresenter;
use App\Repository\AccountingDocumentRepository;
use Launchpad\Common\Exception\ApiException;
use Launchpad\Common\Http\ApiResponse;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\Requirement\Requirement;

/**
 * Routes internes (clé X-Internal-Key) : message-service vérifie qu'un document cité
 * dans un message existe, appartient au dossier et n'est pas supprimé.
 */
final class DocumentInternalController
{
    public function __construct(
        private readonly AccountingDocumentRepository $documents,
        private readonly ApiPresenter $presenter,
    ) {
    }

    /** Documents supprimés inclus (champ "deleted") : c'est à l'appelant de décider. */
    #[Route('/documents/{id}', name: 'internal_document_show', requirements: ['id' => Requirement::UUID], methods: ['GET'])]
    public function show(string $id): JsonResponse
    {
        $document = $this->documents->find($id) ?? throw ApiException::notFound('Document introuvable.');

        return ApiResponse::data($this->presenter->documentReference($document));
    }
}
