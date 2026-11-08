<?php

namespace App\Service;

use App\Dto\SendMessageRequest;
use App\Entity\Message;
use App\Remote\DocumentDirectory;
use Doctrine\ORM\EntityManagerInterface;
use Launchpad\Common\Enum\UserRole;
use Launchpad\Common\Exception\ApiException;
use Launchpad\Common\Messaging\Message\DocumentDecided;
use Launchpad\Common\Remote\ClientFileDirectory;
use Launchpad\Common\Remote\Model\FileContext;
use Launchpad\Common\Security\ActorResolver;
use Launchpad\Common\Security\KeycloakUser;

final class MessageService
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly ClientFileDirectory $files,
        private readonly DocumentDirectory $documents,
        private readonly ActorResolver $actors,
    ) {
    }

    /** Dossier du message, lu auprès de client-file-service. */
    public function fileOf(Message $message): ?FileContext
    {
        return $this->files->context($message->getClientFileId()->toRfc4122());
    }

    public function send(FileContext $file, SendMessageRequest $request, KeycloakUser $sender): Message
    {
        if (!$file->isOpen()) {
            throw ApiException::conflict('FILE_CLOSED', 'Les échanges sont fermés sur un dossier refusé ou clôturé.');
        }

        $role = $this->actors->roleInFile($sender, $file)
            ?? throw ApiException::conflict('MESSAGE_NOT_ALLOWED', 'Vous ne participez pas à ce dossier.');

        if (null !== $request->documentId) {
            $this->assertDocumentInFile($file, $request->documentId);
        }

        $message = new Message(
            clientFileId: $file->id,
            senderId: $sender->getId(),
            senderRole: $role,
            content: trim($request->content),
            documentId: $request->documentId,
        );

        $this->em->persist($message);
        $this->em->flush();

        return $message;
    }

    /**
     * Événement de document-service (RabbitMQ, voir DocumentDecidedListener) : le comptable a validé
     * ou rejeté un document. L'entrepreneur en est informé par un message automatique dans le fil du dossier.
     */
    public function recordDocumentDecision(DocumentDecided $decision): Message
    {
        $document = sprintf('« %s » (v%d)', $decision->title, $decision->versionNumber);
        $lines = [match (true) {
            $decision->revision => sprintf('Décision révisée : document %s %s.', $document, DocumentDecided::VALIDATED === $decision->decision ? 'validé' : 'rejeté'),
            DocumentDecided::VALIDATED === $decision->decision => sprintf('Document %s validé.', $document),
            default => sprintf('Document %s rejeté.', $document),
        }];
        if (null !== $decision->comment && '' !== trim($decision->comment)) {
            $lines[] = (DocumentDecided::REJECTED === $decision->decision ? 'Motif : ' : 'Commentaire : ').trim($decision->comment);
        }
        if (DocumentDecided::REJECTED === $decision->decision) {
            $lines[] = 'Vous pouvez déposer une nouvelle version depuis l\'onglet Documents.';
        }

        $message = new Message(
            clientFileId: $decision->clientFileId,
            senderId: $decision->accountantId,
            senderRole: UserRole::ACCOUNTANT,
            content: implode("\n", $lines),
            documentId: $decision->documentId,
            automatic: true,
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

    /** Le document cité doit exister dans document-service, appartenir au dossier et ne pas être supprimé. */
    private function assertDocumentInFile(FileContext $file, string $documentId): void
    {
        $document = $this->documents->find($documentId);

        if (null === $document || $document->deleted || $document->clientFileId !== $file->id) {
            throw ApiException::invalidField('documentId', 'Document introuvable dans ce dossier.');
        }
    }
}
