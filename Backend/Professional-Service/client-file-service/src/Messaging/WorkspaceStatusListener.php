<?php

namespace App\Messaging;

use App\Service\ClientFileService;
use Launchpad\Common\Messaging\Message\WorkspaceStatusChanged;
use Launchpad\Common\Messaging\QueueListener;
use Launchpad\Common\Messaging\Queues;
use Psr\Log\LoggerInterface;

/**
 * Consommateur de la queue client_file.workspace_status (déclarée par ce service, durable).
 * Publiée par workspace-service quand un administrateur active ou désactive un espace comptable.
 */
final class WorkspaceStatusListener implements QueueListener
{
    public function __construct(
        private readonly ClientFileService $files,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function queue(): string
    {
        return Queues::CLIENT_FILE_WORKSPACE_STATUS;
    }

    public function handle(array $payload): void
    {
        $event = WorkspaceStatusChanged::fromArray($payload);

        // Déléguer la logique métier : dossiers de l'espace en lecture seule, demandes en attente refusées
        $rejected = $this->files->applyWorkspaceStatus($event->workspaceId, $event->active, $event->reason);

        $this->logger->info('Espace {workspace} {state} : {rejected} demande(s) en attente refusée(s)', [
            'workspace' => $event->workspaceId,
            'state' => $event->active ? 'réactivé' : 'désactivé',
            'rejected' => $rejected,
        ]);
    }
}
