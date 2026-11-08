<?php

namespace Launchpad\Common\Messaging;

/**
 * Échec d'un échange avec RabbitMQ (broker injoignable, queue absente…).
 */
final class MessagingException extends \RuntimeException
{
    public static function unreachable(string $host, int $port, \Throwable $previous): self
    {
        return new self(sprintf('RabbitMQ injoignable (%s:%d) : %s', $host, $port, $previous->getMessage()), 0, $previous);
    }

    /** Équivalent du 404 NOT_FOUND de l'atelier : personne n'a déclaré la queue. */
    public static function queueNotFound(string $queue): self
    {
        return new self(sprintf('La queue "%s" n\'existe pas : démarrez d\'abord son consommateur (php bin/console app:rabbitmq:consume).', $queue));
    }

    public static function publishFailed(string $queue, \Throwable $previous): self
    {
        return new self(sprintf('Échec de la publication sur la queue "%s" : %s', $queue, $previous->getMessage()), 0, $previous);
    }
}
