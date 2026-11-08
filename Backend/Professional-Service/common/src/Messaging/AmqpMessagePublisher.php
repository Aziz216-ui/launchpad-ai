<?php

namespace Launchpad\Common\Messaging;

use Launchpad\Common\Messaging\Message\QueueMessage;
use PhpAmqpLib\Message\AMQPMessage;
use Psr\Log\LoggerInterface;
use Symfony\Component\Uid\Uuid;

/**
 * Publie le DTO en JSON sur l'exchange par défaut, avec le nom de la queue comme clé de routage.
 *
 * Le producteur ne déclare pas la queue (c'est le rôle du consommateur). Le message est publié
 * « mandatory » avec confirmation du broker : si la queue n'existe pas, RabbitMQ le renvoie et
 * l'envoi échoue, comme le 404 NOT_FOUND décrit dans l'atelier. Les messages sont persistants
 * (delivery_mode 2) pour survivre à un redémarrage du broker, la queue étant durable.
 */
final class AmqpMessagePublisher implements MessagePublisher
{
    private bool $confirmMode = false;
    private bool $returned = false;

    public function __construct(
        private readonly RabbitMqConnection $connection,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function publish(string $queue, QueueMessage $message): void
    {
        $channel = $this->connection->channel();

        try {
            if (!$this->confirmMode) {
                $channel->confirm_select();
                $channel->set_return_listener(function (): void {
                    $this->returned = true;
                });
                $this->confirmMode = true;
            }

            $this->returned = false;
            $amqpMessage = new AMQPMessage(json_encode($message->toArray(), \JSON_THROW_ON_ERROR | \JSON_UNESCAPED_UNICODE), [
                'content_type' => 'application/json',
                'delivery_mode' => AMQPMessage::DELIVERY_MODE_PERSISTENT,
                'message_id' => Uuid::v7()->toRfc4122(),
                'timestamp' => time(),
                'type' => (new \ReflectionClass($message))->getShortName(),
            ]);

            $channel->basic_publish($amqpMessage, '', $queue, true);
            $channel->wait_for_pending_acks_returns(5);
        } catch (MessagingException $e) {
            throw $e;
        } catch (\Throwable $e) {
            $this->connection->close();
            $this->confirmMode = false;
            throw MessagingException::publishFailed($queue, $e);
        }

        if ($this->returned) {
            throw MessagingException::queueNotFound($queue);
        }

        $this->logger->info('Message {type} envoyé à la queue {queue}', [
            'type' => (new \ReflectionClass($message))->getShortName(),
            'queue' => $queue,
            'payload' => $message->toArray(),
        ]);
    }
}
