<?php

namespace App\Controller;

use App\Dto\DecisionRequest;
use App\Dto\ExternalDocumentRequest;
use App\Dto\UploadDocumentRequest;
use App\Entity\AccountingDocument;
use App\Entity\ClientFile;
use App\Enum\DocumentSource;
use App\Enum\DocumentStatus;
use App\Enum\DocumentType;
use App\Enum\ValidationDecision;
use App\Exception\ApiException;
use App\Http\ApiResponse;
use App\Http\Pagination\Paginator;
use App\Http\QueryParams;
use App\Presenter\ApiPresenter;
use App\Repository\AccountingDocumentRepository;
use App\Repository\DocumentEventRepository;
use App\Repository\ValidationRepository;
use App\Security\KeycloakUser;
use App\Security\Voter\AccountingDocumentVoter;
use App\Security\Voter\ClientFileVoter;
use App\Service\DocumentService;
use App\Storage\DocumentStorageInterface;
use App\Storage\StorageException;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\HeaderUtils;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\HttpKernel\Attribute\MapUploadedFile;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\Requirement\Requirement;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

final class DocumentController
{
    public function __construct(
        private readonly DocumentService $service,
        private readonly AccountingDocumentRepository $documents,
        private readonly ValidationRepository $validations,
        private readonly DocumentEventRepository $events,
        private readonly DocumentStorageInterface $storage,
        private readonly ApiPresenter $presenter,
        private readonly Paginator $paginator,
    ) {
    }

    /**
     * Documents d'un dossier (dernière version uniquement, sauf ?includeHistory=true).
     * Filtres facultatifs : ?status=..., ?type=...
     */
    #[Route('/files/{id}/documents', name: 'document_list', requirements: ['id' => Requirement::UUID], methods: ['GET'])]
    #[IsGranted(ClientFileVoter::VIEW, subject: 'file')]
    public function list(ClientFile $file, Request $request): JsonResponse
    {
        $query = $this->documents->createByClientFileQuery(
            $file,
            includeHistory: $request->query->getBoolean('includeHistory'),
            status: QueryParams::enum($request, 'status', DocumentStatus::class),
            type: QueryParams::enum($request, 'type', DocumentType::class),
        );

        return ApiResponse::page($this->paginator->paginate($query, $request, $this->presenter->document(...)));
    }

    /** Dépôt d'un fichier (multipart/form-data : file, title, type, periodStart, periodEnd). */
    #[Route('/files/{id}/documents', name: 'document_upload', requirements: ['id' => Requirement::UUID], methods: ['POST'])]
    #[IsGranted(ClientFileVoter::UPLOAD_DOCUMENT, subject: 'file')]
    public function upload(
        ClientFile $file,
        #[MapRequestPayload] UploadDocumentRequest $request,
        #[CurrentUser] KeycloakUser $user,
        #[MapUploadedFile(name: 'file')] ?UploadedFile $upload = null,
    ): JsonResponse {
        $document = $this->service->upload($file, $upload, $request, $user);

        return ApiResponse::data($this->presenter->document($document), Response::HTTP_CREATED);
    }

    /** Déclaration d'un document détenu par un autre service (JSON). */
    #[Route('/files/{id}/documents/external', name: 'document_declare_external', requirements: ['id' => Requirement::UUID], methods: ['POST'])]
    #[IsGranted(ClientFileVoter::DECLARE_EXTERNAL_DOCUMENT, subject: 'file')]
    public function declareExternal(ClientFile $file, #[MapRequestPayload] ExternalDocumentRequest $request, #[CurrentUser] KeycloakUser $user): JsonResponse
    {
        $document = $this->service->declareExternal($file, $request, $user);

        return ApiResponse::data($this->presenter->document($document), Response::HTTP_CREATED);
    }

    #[Route('/documents/{id}', name: 'document_show', requirements: ['id' => Requirement::UUID], methods: ['GET'])]
    #[IsGranted(AccountingDocumentVoter::VIEW, subject: 'document')]
    public function show(AccountingDocument $document): JsonResponse
    {
        return ApiResponse::data($this->presenter->document($document));
    }

    /** Téléchargement après contrôle des droits : aucun fichier n'est exposé publiquement. */
    #[Route('/documents/{id}/download', name: 'document_download', requirements: ['id' => Requirement::UUID], methods: ['GET'])]
    #[IsGranted(AccountingDocumentVoter::DOWNLOAD, subject: 'document')]
    public function download(AccountingDocument $document): Response
    {
        if (DocumentSource::UPLOAD !== $document->getSource()) {
            throw ApiException::conflict('EXTERNAL_DOCUMENT', sprintf(
                'Document externe : il est disponible auprès du service "%s" (référence %s).',
                $document->getExternalService(),
                $document->getExternalRef(),
            ));
        }

        try {
            $stream = $this->storage->readStream((string) $document->getStorageKey());
        } catch (StorageException) {
            throw ApiException::notFound('Le fichier de ce document est introuvable dans le stockage.');
        }

        $response = new StreamedResponse(static function () use ($stream): void {
            fpassthru($stream);
            fclose($stream);
        });

        $filename = (string) $document->getOriginalFilename();
        $fallback = preg_replace('/[^A-Za-z0-9._-]/', '_', $filename) ?: 'document';
        $response->headers->set('Content-Type', (string) $document->getMimeType());
        $response->headers->set('Content-Length', (string) $document->getSize());
        $response->headers->set('Content-Disposition', HeaderUtils::makeDisposition(HeaderUtils::DISPOSITION_ATTACHMENT, $filename, $fallback));
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Cache-Control', 'private, no-store');

        return $response;
    }

    /** Suppression logique (204). */
    #[Route('/documents/{id}', name: 'document_delete', requirements: ['id' => Requirement::UUID], methods: ['DELETE'])]
    #[IsGranted(AccountingDocumentVoter::DELETE, subject: 'document')]
    public function delete(AccountingDocument $document, #[CurrentUser] KeycloakUser $user): Response
    {
        $this->service->delete($document, $user);

        return ApiResponse::noContent();
    }

    /** Nouvelle version (fichier) d'un document rejeté. */
    #[Route('/documents/{id}/versions', name: 'document_new_version', requirements: ['id' => Requirement::UUID], methods: ['POST'])]
    #[IsGranted(AccountingDocumentVoter::NEW_VERSION, subject: 'document')]
    public function newVersion(
        AccountingDocument $document,
        #[MapRequestPayload] UploadDocumentRequest $request,
        #[CurrentUser] KeycloakUser $user,
        #[MapUploadedFile(name: 'file')] ?UploadedFile $upload = null,
    ): JsonResponse {
        $this->service->assertCanReplace($document);
        $version = $this->service->upload($document->getClientFile(), $upload, $request, $user, previous: $document);

        return ApiResponse::data($this->presenter->document($version), Response::HTTP_CREATED);
    }

    /** Nouvelle version (référence externe) d'un document rejeté. */
    #[Route('/documents/{id}/versions/external', name: 'document_new_external_version', requirements: ['id' => Requirement::UUID], methods: ['POST'])]
    #[IsGranted(AccountingDocumentVoter::NEW_VERSION, subject: 'document')]
    public function newExternalVersion(AccountingDocument $document, #[MapRequestPayload] ExternalDocumentRequest $request, #[CurrentUser] KeycloakUser $user): JsonResponse
    {
        $this->service->assertCanReplace($document);
        $version = $this->service->declareExternal($document->getClientFile(), $request, $user, previous: $document);

        return ApiResponse::data($this->presenter->document($version), Response::HTTP_CREATED);
    }

    #[Route('/documents/{id}/validate', name: 'document_validate', requirements: ['id' => Requirement::UUID], methods: ['POST'])]
    #[IsGranted(AccountingDocumentVoter::DECIDE, subject: 'document')]
    public function validate(AccountingDocument $document, #[CurrentUser] KeycloakUser $user, #[MapRequestPayload] ?DecisionRequest $request = null): JsonResponse
    {
        return $this->decide($document, ValidationDecision::VALIDATED, $request, $user);
    }

    #[Route('/documents/{id}/reject', name: 'document_reject', requirements: ['id' => Requirement::UUID], methods: ['POST'])]
    #[IsGranted(AccountingDocumentVoter::DECIDE, subject: 'document')]
    public function reject(AccountingDocument $document, #[CurrentUser] KeycloakUser $user, #[MapRequestPayload] ?DecisionRequest $request = null): JsonResponse
    {
        return $this->decide($document, ValidationDecision::REJECTED, $request, $user);
    }

    #[Route('/documents/{id}/validations', name: 'document_validations', requirements: ['id' => Requirement::UUID], methods: ['GET'])]
    #[IsGranted(AccountingDocumentVoter::VIEW, subject: 'document')]
    public function validations(AccountingDocument $document, Request $request): JsonResponse
    {
        return ApiResponse::page($this->paginator->paginate(
            $this->validations->createByDocumentQuery($document),
            $request,
            $this->presenter->validation(...),
        ));
    }

    #[Route('/documents/{id}/events', name: 'document_events', requirements: ['id' => Requirement::UUID], methods: ['GET'])]
    #[IsGranted(AccountingDocumentVoter::VIEW, subject: 'document')]
    public function events(AccountingDocument $document, Request $request): JsonResponse
    {
        return ApiResponse::page($this->paginator->paginate(
            $this->events->createByDocumentQuery($document),
            $request,
            $this->presenter->documentEvent(...),
        ));
    }

    private function decide(AccountingDocument $document, ValidationDecision $decision, ?DecisionRequest $request, KeycloakUser $user): JsonResponse
    {
        $validation = $this->service->decide($document, $decision, $request?->comment, $user);

        return ApiResponse::data([
            'document' => $this->presenter->document($document),
            'validation' => $this->presenter->validation($validation),
        ], Response::HTTP_CREATED);
    }
}
