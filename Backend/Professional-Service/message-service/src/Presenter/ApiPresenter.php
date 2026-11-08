<?php

namespace App\Presenter;

use App\Entity\Message;

/**
 * Représentation JSON des ressources de l'API (contrat explicite, indépendant des entités).
 */
final class ApiPresenter
{
    /**
     * @return array<string, mixed>
     */
    public function message(Message $message): array
    {
        return [
            'id' => $message->getId()->toRfc4122(),
            'clientFileId' => $message->getClientFileId()->toRfc4122(),
            'documentId' => $message->getDocumentId()?->toRfc4122(),
            'senderId' => $message->getSenderId(),
            'senderRole' => $message->getSenderRole()->value,
            'content' => $message->getContent(),
            'automatic' => $message->isAutomatic(),
            'readAt' => $this->date($message->getReadAt()),
            'createdAt' => $this->date($message->getCreatedAt()),
        ];
    }

    private function date(?\DateTimeImmutable $date): ?string
    {
        return $date?->format(\DateTimeInterface::ATOM);
    }
}
