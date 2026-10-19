<?php

namespace App\Service;

use App\Dto\ExternalDocumentRequest;
use App\Dto\UploadDocumentRequest;
use App\Entity\AccountingDocument;
use App\Entity\ClientFile;
use App\Entity\DocumentEvent;
use App\Entity\Validation;
use App\Enum\ClientFileStatus;
use App\Enum\DocumentEventType;
use App\Enum\DocumentStatus;
use App\Enum\UserRole;
use App\Enum\ValidationDecision;
use App\Exception\ApiException;
use App\Repository\AccountingDocumentRepository;
use App\Security\ActorResolver;
use App\Security\KeycloakUser;
use App\Storage\DocumentStorageInterface;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\Validator\Constraints as Assert;
use Symfony\Component\Validator\Validator\ValidatorInterface;

/**
 * Dépôt, versionnement, suppression logique et validation des documents comptables.
 */
final class DocumentService
{
    /** Extensions acceptées et types MIME attendus (détectés via fileinfo, pas fournis par le client). */
    public const ALLOWED_FILES = [
        'pdf' => ['application/pdf'],
        'png' => ['image/png'],
        'jpg' => ['image/jpeg'],
        'jpeg' => ['image/jpeg'],
        'xlsx' => ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ];

    public const ACCOUNTANT_UPLOAD_COMMENT = 'Document déposé par le comptable : validé automatiquement.';

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly AccountingDocumentRepository $documents,
        private readonly DocumentStorageInterface $storage,
        private readonly ValidatorInterface $validator,
        private readonly ActorResolver $actors,
        private readonly string $maxUploadSize,
    ) {
    }

    /**
     * Dépôt d'un fichier. Entrepreneur : statut PENDING.
     * Comptable : statut VALIDATED directement, avec une ligne de validation automatique.
     */
    public function upload(ClientFile $file, ?UploadedFile $upload, UploadDocumentRequest $request, KeycloakUser $user, ?AccountingDocument $previous = null): AccountingDocument
    {
        $this->assertFileActive($file);
        $role = $this->uploaderRole($file, $user);
        $upload = $this->validateUpload($upload);

        $extension = strtolower($upload->getClientOriginalExtension());
        $checksum = hash_file('sha256', $upload->getPathname());
        $size = (int) $upload->getSize();
        $mimeType = (string) $upload->getMimeType();
        $storageKey = $this->storage->store($upload, $file->getId()->toRfc4122(), $extension);

        $document = AccountingDocument::uploaded(
            clientFile: $file,
            title: $request->title,
            type: $request->type,
            uploadedBy: $user->getId(),
            uploadedByRole: $role,
            storageKey: $storageKey,
            originalFilename: mb_substr(basename($upload->getClientOriginalName()), 0, 255),
            mimeType: $mimeType,
            size: $size,
            checksum: $checksum,
        );
        $document->setPeriod($request->periodStart, $request->periodEnd);

        return $this->register($document, $user, $role, $previous);
    }

    /** Déclaration d'un document externe (entrepreneur uniquement en v1). */
    public function declareExternal(ClientFile $file, ExternalDocumentRequest $request, KeycloakUser $user, ?AccountingDocument $previous = null): AccountingDocument
    {
        $this->assertFileActive($file);

        $document = AccountingDocument::external(
            clientFile: $file,
            title: $request->title,
            type: $request->type,
            uploadedBy: $user->getId(),
            uploadedByRole: UserRole::ENTREPRENEUR,
            externalRef: $request->externalRef,
            externalService: $request->externalService,
        );
        $document->setPeriod($request->periodStart, $request->periodEnd);

        return $this->register($document, $user, UserRole::ENTREPRENEUR, $previous);
    }

    /**
     * Vérifie qu'une nouvelle version peut remplacer $previous (à appeler avant upload / declareExternal).
     */
    public function assertCanReplace(AccountingDocument $previous): void
    {
        if (UserRole::ENTREPRENEUR !== $previous->getUploadedByRole()) {
            throw ApiException::conflict('VERSIONING_NOT_ALLOWED', 'Les documents du comptable ne sont pas versionnés : supprimez-le puis déposez-le à nouveau.');
        }
        if (DocumentStatus::REJECTED !== $previous->getStatus()) {
            throw ApiException::conflict('INVALID_STATUS', 'Une nouvelle version n\'est possible que si la version précédente a été rejetée.');
        }
        if ($this->documents->hasNextVersion($previous)) {
            throw ApiException::conflict('NEWER_VERSION_EXISTS', 'Une version plus récente de ce document existe déjà.');
        }
    }

    /**
     * Suppression logique : le fichier reste stocké, le document disparaît des listes,
     * un événement DELETED est tracé.
     */
    public function delete(AccountingDocument $document, KeycloakUser $user): void
    {
        $this->assertFileActive($document->getClientFile());

        if (UserRole::ENTREPRENEUR === $document->getUploadedByRole() && DocumentStatus::PENDING !== $document->getStatus()) {
            throw ApiException::conflict('INVALID_STATUS', 'Seul un document en attente de validation peut être supprimé.');
        }

        $document->softDelete();
        $this->em->persist(new DocumentEvent(
            document: $document,
            type: DocumentEventType::DELETED,
            actorId: $user->getId(),
            actorRole: $document->getUploadedByRole(),
        ));
        $this->em->flush();
    }

    /**
     * Décision du comptable (validation, rejet ou révision d'une décision précédente).
     * Chaque décision ajoute une ligne d'historique.
     */
    public function decide(AccountingDocument $document, ValidationDecision $decision, ?string $comment, KeycloakUser $accountant): Validation
    {
        $this->assertFileActive($document->getClientFile());

        if (UserRole::ENTREPRENEUR !== $document->getUploadedByRole()) {
            throw ApiException::conflict('VALIDATION_NOT_APPLICABLE', 'Les documents déposés par le comptable ne passent pas par le circuit de validation.');
        }
        if ($this->documents->hasNextVersion($document)) {
            throw ApiException::conflict('NEWER_VERSION_EXISTS', 'Une version plus récente existe : cette décision ne peut plus être révisée.');
        }

        $previousStatus = $document->getStatus();
        if ($previousStatus === $decision->toDocumentStatus()) {
            throw ApiException::badRequest('SAME_DECISION', 'Le document a déjà ce statut.');
        }

        $comment = null !== $comment && '' !== trim($comment) ? trim($comment) : null;
        $isRevision = DocumentStatus::PENDING !== $previousStatus;
        if (null === $comment && (ValidationDecision::REJECTED === $decision || $isRevision)) {
            throw ApiException::invalidField('comment', $isRevision
                ? 'Un commentaire est obligatoire pour réviser une décision.'
                : 'Un commentaire est obligatoire pour rejeter un document.');
        }

        $validation = new Validation($document, $accountant->getId(), $decision, $previousStatus, $comment);
        $document->changeStatus($decision->toDocumentStatus());

        $this->em->persist($validation);
        $this->em->flush();

        return $validation;
    }

    private function register(AccountingDocument $document, KeycloakUser $user, UserRole $role, ?AccountingDocument $previous): AccountingDocument
    {
        if (null !== $previous) {
            $document->replaces($previous);
        }

        $this->em->persist($document);

        if (UserRole::ACCOUNTANT === $role) {
            // Les documents du comptable sont validés d'office, avec une trace dans l'historique
            $document->changeStatus(DocumentStatus::VALIDATED);
            $this->em->persist(new Validation(
                document: $document,
                accountantId: $user->getId(),
                decision: ValidationDecision::VALIDATED,
                previousStatus: DocumentStatus::PENDING,
                comment: self::ACCOUNTANT_UPLOAD_COMMENT,
                automatic: true,
            ));
        }

        $this->em->flush();

        return $document;
    }

    private function uploaderRole(ClientFile $file, KeycloakUser $user): UserRole
    {
        $role = $this->actors->roleInFile($user, $file);
        if (UserRole::ENTREPRENEUR !== $role && UserRole::ACCOUNTANT !== $role) {
            throw ApiException::conflict('UPLOAD_NOT_ALLOWED', 'Seuls l\'entrepreneur et le comptable du dossier peuvent déposer des documents.');
        }

        return $role;
    }

    private function validateUpload(?UploadedFile $upload): UploadedFile
    {
        $violations = $this->validator->validate($upload, [
            new Assert\NotNull(message: 'Le fichier est obligatoire (champ "file").'),
            new Assert\File(
                maxSize: $this->maxUploadSize,
                extensions: self::ALLOWED_FILES,
                extensionsMessage: 'Formats acceptés : PDF, PNG, JPG, XLSX.',
                mimeTypesMessage: 'Le contenu du fichier ne correspond pas à son extension ({{ type }}).',
            ),
        ]);

        if (\count($violations) > 0) {
            throw ApiException::invalidField('file', (string) $violations->get(0)->getMessage());
        }

        return $upload;
    }

    private function assertFileActive(ClientFile $file): void
    {
        if (ClientFileStatus::ACTIVE !== $file->getStatus()) {
            throw ApiException::conflict('FILE_NOT_ACTIVE', 'Cette action n\'est possible que sur un dossier actif.');
        }
    }
}
