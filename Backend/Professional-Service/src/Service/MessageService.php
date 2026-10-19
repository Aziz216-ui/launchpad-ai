<?php

namespace App\Service;

use App\Dto\SendMessageRequest;
use App\Entity\AccountingDocument;
use App\Entity\ClientFile;
use App\Entity\Message;
use App\Exception\ApiException;
use App\Repository\AccountingDocumentRepository;
use App\Security\ActorResolver;
use App\Security\KeycloakUser;
use Doctrine\ORM\EntityManagerInterface;

final class MessageService
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly AccountingDocumentRepository $documents,
        private readonly ActorResolver $actors,
    ) {
    }

    public function send(ClientFile $file, SendMessageRequest $request, KeycloakUser $sender): Message
    {
        if (!$file->getStatus()->isOpen()) {
            throw ApiException::conflict('FILE_CLOSED', 'Les échanges sont fermés sur un dossier refusé ou clôturé.');
        }

        $role = $this->actors->roleInFile($sender, $file)
            ?? throw ApiException::conflict('MESSAGE_NOT_ALLOWED', 'Vous ne participez pas à ce dossier.');

        $message = new Message(
            clientFile: $file,
            senderId: $sender->getId(),
            senderRole: $role,
            content: trim($request->content),
            document: null !== $request->documentId ? $this->findDocument($file, $request->documentId) : null,
        );

        $this->em->persist($message);
        $this->em->flush();

        return $message;
    }

    public function markAsRead(Message $message): void
    {
        $message->markAsRead();
        $this->em->flush();
    }

    private function findDocument(ClientFile $file, string $documentId): AccountingDocument
    {
        $document = $this->documents->find($documentId);

        if (null === $document || $document->isDeleted() || $document->getClientFile() !== $file) {
            throw ApiException::invalidField('documentId', 'Document introuvable dans ce dossier.');
        }

        return $document;
    }
}
