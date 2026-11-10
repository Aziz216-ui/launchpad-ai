<?php

namespace App\Messaging;

use App\Service\WorkspaceService;
use Launchpad\Common\Messaging\Message\AccountantRegistered;
use Launchpad\Common\Messaging\QueueListener;
use Launchpad\Common\Messaging\Queues;
use Psr\Log\LoggerInterface;

/**
 * Consommateur de la queue workspace.accountant_registered (déclarée par ce service, durable).
 * Publiée par User-Service à l'inscription d'un comptable : son espace est créé et ouvert aux demandes,
 * il apparaît donc aussitôt dans l'annuaire « Demander un comptable » des entrepreneurs.
 * Traitement idempotent : un message rejoué ne recrée pas l'espace et ne change pas son état.
 */
final class AccountantRegisteredListener implements QueueListener
{
    public function __construct(
        private readonly WorkspaceService $workspaces,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function queue(): string
    {
        return Queues::WORKSPACE_ACCOUNTANT_REGISTERED;
    }

    public function handle(array $payload): void
    {
        $event = AccountantRegistered::fromArray($payload);
        [$workspace, $created] = $this->workspaces->provisionRegisteredAccountant($event->accountantId, $event->displayName);

        $this->logger->info('Comptable {accountant} : espace {workspace} {state}', [
            'accountant' => $event->accountantId,
            'workspace' => $workspace->getId()->toRfc4122(),
            'state' => $created ? 'créé (ouvert aux demandes)' : 'déjà existant',
        ]);
    }
}
