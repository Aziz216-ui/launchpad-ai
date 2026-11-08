<?php

namespace Launchpad\Common\Messaging\Message;

/**
 * Message échangé via RabbitMQ (DTO) : représente les données partagées entre deux services,
 * indépendamment des entités Doctrine de chacun.
 */
interface QueueMessage
{
    /**
     * @return array<string, mixed> contenu JSON du message
     */
    public function toArray(): array;
}
