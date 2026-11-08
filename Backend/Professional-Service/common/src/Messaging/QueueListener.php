<?php

namespace Launchpad\Common\Messaging;

use Symfony\Component\DependencyInjection\Attribute\AutoconfigureTag;

/**
 * Consommateur d'une queue (équivalent de @RabbitListener de l'atelier).
 * Chaque implémentation est découverte automatiquement par app:rabbitmq:consume,
 * qui déclare sa queue (durable) puis lui transmet chaque message reçu.
 */
#[AutoconfigureTag(self::TAG)]
interface QueueListener
{
    public const TAG = 'launchpad.queue_listener';

    /** Nom de la queue écoutée (voir Queues). */
    public function queue(): string;

    /**
     * Traite un message déjà décodé depuis le JSON.
     * Une exception refuse le message : il est remis une fois dans la queue, puis écarté.
     *
     * @param array<string, mixed> $payload
     */
    public function handle(array $payload): void;
}
