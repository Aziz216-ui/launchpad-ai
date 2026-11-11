<?php

namespace App\Messaging;

use App\Service\MessageService;
use Launchpad\Common\Messaging\Message\FileActivity;
use Launchpad\Common\Messaging\QueueListener;
use Launchpad\Common\Messaging\Queues;
use Psr\Log\LoggerInterface;

/**
 * Consommateur de la queue message.file_activity (déclarée par ce service, durable).
 * Publiée par client-file-service (demande, acceptation, refus, clôture) et document-service (dépôt de
 * l'entrepreneur) : l'activité devient un message automatique du fil, donc une notification pour
 * l'autre participant.
 */
final class FileActivityListener implements QueueListener
{
    public function __construct(
        private readonly MessageService $messages,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function queue(): string
    {
        return Queues::MESSAGE_FILE_ACTIVITY;
    }

    public function handle(array $payload): void
    {
        $activity = FileActivity::fromArray($payload);
        $message = $this->messages->recordFileActivity($activity);

        $this->logger->info('Activité {activity} du dossier {file} notifiée (message {message})', [
            'activity' => $activity->activity,
            'file' => $activity->clientFileId,
            'message' => $message->getId()->toRfc4122(),
        ]);
    }
}
