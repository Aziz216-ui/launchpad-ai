<?php

namespace App\Presenter;

use App\Entity\AccountantWorkspace;
use App\Entity\AccountingDocument;
use App\Entity\ClientFile;
use App\Entity\ClientFileAssignment;
use App\Entity\DocumentEvent;
use App\Entity\Message;
use App\Entity\Validation;
use App\Enum\DocumentSource;
use App\Security\KeycloakUser;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;

/**
 * Représentation JSON des ressources de l'API (contrat explicite, indépendant des entités).
 */
final class ApiPresenter
{
    public function __construct(private readonly UrlGeneratorInterface $urlGenerator)
    {
    }

    /**
     * @return array<string, mixed>
     */
    public function user(KeycloakUser $user, ?AccountantWorkspace $workspace): array
    {
        return [
            'id' => $user->getId(),
            'username' => $user->getUsername(),
            'email' => $user->getEmail(),
            'firstName' => $user->getFirstName(),
            'lastName' => $user->getLastName(),
            'displayName' => $user->getDisplayName(),
            'roles' => $user->getRoles(),
            'workspaceId' => $workspace?->getId()->toRfc4122(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function workspace(AccountantWorkspace $workspace): array
    {
        return [
            'id' => $workspace->getId()->toRfc4122(),
            'accountantId' => $workspace->getAccountantId(),
            'displayName' => $workspace->getDisplayName(),
            'acceptingClients' => $workspace->isAcceptingClients(),
            'active' => $workspace->isActive(),
            'createdAt' => $this->date($workspace->getCreatedAt()),
            'updatedAt' => $this->date($workspace->getUpdatedAt()),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function clientFile(ClientFile $file): array
    {
        $workspace = $file->getWorkspace();

        return [
            'id' => $file->getId()->toRfc4122(),
            'reference' => $file->getReference(),
            'status' => $file->getStatus()->value,
            'startupId' => $file->getStartupId(),
            'startupName' => $file->getStartupName(),
            'entrepreneurId' => $file->getEntrepreneurId(),
            'entrepreneurDisplayName' => $file->getEntrepreneurDisplayName(),
            'requestMessage' => $file->getRequestMessage(),
            'rejectionReason' => $file->getRejectionReason(),
            'workspace' => [
                'id' => $workspace->getId()->toRfc4122(),
                'accountantId' => $workspace->getAccountantId(),
                'displayName' => $workspace->getDisplayName(),
            ],
            'decidedAt' => $this->date($file->getDecidedAt()),
            'closedAt' => $this->date($file->getClosedAt()),
            'createdAt' => $this->date($file->getCreatedAt()),
            'updatedAt' => $this->date($file->getUpdatedAt()),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function assignment(ClientFileAssignment $assignment): array
    {
        return [
            'id' => $assignment->getId()->toRfc4122(),
            'type' => $assignment->getType()->value,
            'previousAccountantId' => $assignment->getPreviousAccountantId(),
            'newAccountantId' => $assignment->getNewAccountantId(),
            'assignedBy' => $assignment->getAssignedBy(),
            'reason' => $assignment->getReason(),
            'assignedAt' => $this->date($assignment->getAssignedAt()),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function document(AccountingDocument $document): array
    {
        $isUpload = DocumentSource::UPLOAD === $document->getSource();

        return [
            'id' => $document->getId()->toRfc4122(),
            'clientFileId' => $document->getClientFile()->getId()->toRfc4122(),
            'title' => $document->getTitle(),
            'type' => $document->getType()->value,
            'source' => $document->getSource()->value,
            'status' => $document->getStatus()->value,
            'versionNumber' => $document->getVersionNumber(),
            'previousVersionId' => $document->getPreviousVersion()?->getId()->toRfc4122(),
            'periodStart' => $document->getPeriodStart()?->format('Y-m-d'),
            'periodEnd' => $document->getPeriodEnd()?->format('Y-m-d'),
            'file' => $isUpload ? [
                'originalFilename' => $document->getOriginalFilename(),
                'mimeType' => $document->getMimeType(),
                'size' => $document->getSize(),
                'checksum' => $document->getChecksum(),
                'downloadUrl' => $this->urlGenerator->generate('document_download', ['id' => $document->getId()->toRfc4122()]),
            ] : null,
            'external' => $isUpload ? null : [
                'ref' => $document->getExternalRef(),
                'service' => $document->getExternalService(),
            ],
            'uploadedBy' => $document->getUploadedBy(),
            'uploadedByRole' => $document->getUploadedByRole()->value,
            'uploadedAt' => $this->date($document->getUploadedAt()),
            'updatedAt' => $this->date($document->getUpdatedAt()),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function validation(Validation $validation): array
    {
        return [
            'id' => $validation->getId()->toRfc4122(),
            'decision' => $validation->getDecision()->value,
            'previousStatus' => $validation->getPreviousStatus()->value,
            'revision' => $validation->isRevision(),
            'automatic' => $validation->isAutomatic(),
            'comment' => $validation->getComment(),
            'accountantId' => $validation->getAccountantId(),
            'createdAt' => $this->date($validation->getCreatedAt()),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function documentEvent(DocumentEvent $event): array
    {
        return [
            'id' => $event->getId()->toRfc4122(),
            'type' => $event->getType()->value,
            'actorId' => $event->getActorId(),
            'actorRole' => $event->getActorRole()->value,
            'comment' => $event->getComment(),
            'createdAt' => $this->date($event->getCreatedAt()),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function message(Message $message): array
    {
        return [
            'id' => $message->getId()->toRfc4122(),
            'clientFileId' => $message->getClientFile()->getId()->toRfc4122(),
            'documentId' => $message->getDocument()?->getId()->toRfc4122(),
            'senderId' => $message->getSenderId(),
            'senderRole' => $message->getSenderRole()->value,
            'content' => $message->getContent(),
            'readAt' => $this->date($message->getReadAt()),
            'createdAt' => $this->date($message->getCreatedAt()),
        ];
    }

    private function date(?\DateTimeImmutable $date): ?string
    {
        return $date?->format(\DateTimeInterface::ATOM);
    }
}
