<?php

namespace Launchpad\Common\Testing;

use Launchpad\Common\Messaging\Message\QueueMessage;
use Launchpad\Common\Messaging\MessagePublisher;
use Launchpad\Common\Messaging\MessagingException;

/**
 * Doublure de RabbitMQ pour les tests : garde les messages publiés en mémoire,
 * ou simule un broker injoignable.
 */
final class FakeMessagePublisher implements MessagePublisher
{
    /** @var list<array{queue: string, message: QueueMessage}> */
    public array $published = [];

    public bool $unavailable = false;

    public function publish(string $queue, QueueMessage $message): void
    {
        if ($this->unavailable) {
            throw MessagingException::unreachable('rabbitmq.test', 5672, new \RuntimeException('Connexion refusée'));
        }
        $this->published[] = ['queue' => $queue, 'message' => $message];
    }

    /**
     * @return list<QueueMessage>
     */
    public function on(string $queue): array
    {
        return array_values(array_map(
            static fn (array $entry): QueueMessage => $entry['message'],
            array_filter($this->published, static fn (array $entry): bool => $entry['queue'] === $queue),
        ));
    }
}
