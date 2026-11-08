<?php

namespace Launchpad\Common\Messaging;

use PhpAmqpLib\Channel\AMQPChannel;
use PhpAmqpLib\Connection\AMQPStreamConnection;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Connexion AMQP au broker (équivalent de spring.rabbitmq.host / port / username / password),
 * ouverte à la première utilisation : un service qui ne publie rien ne se connecte jamais.
 */
final class RabbitMqConnection
{
    private ?AMQPStreamConnection $connection = null;
    private ?AMQPChannel $channel = null;

    public function __construct(
        #[Autowire(env: 'RABBITMQ_HOST')] private readonly string $host,
        #[Autowire(env: 'int:RABBITMQ_PORT')] private readonly int $port,
        #[Autowire(env: 'RABBITMQ_USER')] private readonly string $user,
        #[Autowire(env: 'RABBITMQ_PASSWORD')] private readonly string $password,
        #[Autowire(env: 'RABBITMQ_VHOST')] private readonly string $vhost,
    ) {
    }

    public function channel(): AMQPChannel
    {
        if (null !== $this->channel && $this->channel->is_open()) {
            return $this->channel;
        }

        try {
            // Délai de connexion court ; heartbeat 30 s pour les consommateurs qui restent connectés
            $this->connection = new AMQPStreamConnection(
                $this->host, $this->port, $this->user, $this->password, $this->vhost,
                false, 'AMQPLAIN', null, 'en_US', 3.0, 60.0, null, true, 30,
            );
            $this->channel = $this->connection->channel();
        } catch (\Throwable $e) {
            throw MessagingException::unreachable($this->host, $this->port, $e);
        }

        return $this->channel;
    }

    public function close(): void
    {
        try {
            $this->channel?->close();
            $this->connection?->close();
        } catch (\Throwable) {
            // Fermeture au mieux : la connexion est peut-être déjà perdue
        }
        $this->channel = null;
        $this->connection = null;
    }

    public function __destruct()
    {
        $this->close();
    }
}
