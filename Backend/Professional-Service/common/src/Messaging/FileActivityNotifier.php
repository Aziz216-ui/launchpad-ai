<?php

namespace Launchpad\Common\Messaging;

use Launchpad\Common\Enum\UserRole;
use Launchpad\Common\Messaging\Message\FileActivity;
use Psr\Log\LoggerInterface;

/**
 * Publie une activité de dossier (queue message.file_activity) après l'action, sans la bloquer :
 * la notification est un « plus », une panne de RabbitMQ ne doit pas faire échouer une demande,
 * une acceptation ou un dépôt. L'échec est journalisé.
 */
final class FileActivityNotifier
{
    public function __construct(
        private readonly MessagePublisher $publisher,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function notify(string $clientFileId, string $activity, string $actorId, UserRole $actorRole, string $content, ?string $documentId = null): void
    {
        try {
            $this->publisher->publish(Queues::MESSAGE_FILE_ACTIVITY, new FileActivity(
                clientFileId: $clientFileId,
                activity: $activity,
                actorId: $actorId,
                actorRole: $actorRole->value,
                content: $content,
                documentId: $documentId,
                occurredAt: (new \DateTimeImmutable())->format(\DateTimeInterface::ATOM),
            ));
        } catch (MessagingException $e) {
            $this->logger->error('Activité {activity} du dossier {file} non notifiée : {error}', [
                'activity' => $activity,
                'file' => $clientFileId,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
