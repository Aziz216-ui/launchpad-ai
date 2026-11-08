<?php

namespace App\Messaging;

use App\Service\MessageService;
use Launchpad\Common\Messaging\Message\DocumentDecided;
use Launchpad\Common\Messaging\QueueListener;
use Launchpad\Common\Messaging\Queues;
use Psr\Log\LoggerInterface;

/**
 * Consommateur de la queue message.document_decided (déclarée par ce service, durable).
 * Publiée par document-service quand un comptable valide ou rejette un document.
 */
final class DocumentDecidedListener implements QueueListener
{
    public function __construct(
        private readonly MessageService $messages,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function queue(): string
    {
        return Queues::MESSAGE_DOCUMENT_DECIDED;
    }

    public function handle(array $payload): void
    {
        $decision = DocumentDecided::fromArray($payload);

        // Déléguer la logique métier : notification dans le fil du dossier
        $message = $this->messages->recordDocumentDecision($decision);

        $this->logger->info('Notification envoyée à l\'entrepreneur : document « {title} » {decision} (message {message})', [
            'title' => $decision->title,
            'decision' => DocumentDecided::VALIDATED === $decision->decision ? 'validé' : 'rejeté',
            'message' => $message->getId()->toRfc4122(),
        ]);
    }
}
