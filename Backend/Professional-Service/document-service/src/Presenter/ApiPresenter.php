<?php

namespace App\Presenter;

use App\Entity\AccountingDocument;
use App\Entity\DocumentEvent;
use App\Entity\Validation;
use App\Enum\DocumentSource;
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
    public function document(AccountingDocument $document): array
    {
        $isUpload = DocumentSource::UPLOAD === $document->getSource();

        return [
            'id' => $document->getId()->toRfc4122(),
            'clientFileId' => $document->getClientFileId()->toRfc4122(),
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
     * Référence d'un document pour les autres services (message-service).
     *
     * @return array<string, mixed>
     */
    public function documentReference(AccountingDocument $document): array
    {
        return [
            'id' => $document->getId()->toRfc4122(),
            'clientFileId' => $document->getClientFileId()->toRfc4122(),
            'title' => $document->getTitle(),
            'deleted' => $document->isDeleted(),
        ];
    }

    private function date(?\DateTimeImmutable $date): ?string
    {
        return $date?->format(\DateTimeInterface::ATOM);
    }
}
