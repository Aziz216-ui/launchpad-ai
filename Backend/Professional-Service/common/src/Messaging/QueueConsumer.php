<?php

namespace Launchpad\Common\Messaging;

use Doctrine\Persistence\ManagerRegistry;
use PhpAmqpLib\Exception\AMQPTimeoutException;
use PhpAmqpLib\Message\AMQPMessage;
use Psr\Log\LoggerInterface;
use Symfony\Component\DependencyInjection\Attribute\AutowireIterator;

/**
 * Déclare les queues des consommateurs du service et leur distribue les messages.
 *
 * - La queue est déclarée côté consommateur, durable, comme recommandé dans l'atelier.
 * - Un seul message à la fois par consommateur (prefetch 1), ordre FIFO.
 * - Acquittement manuel : un message n'est retiré de la queue qu'une fois traité.
 *   En cas d'erreur, il est remis une fois dans la queue, puis écarté (journalisé) pour ne pas bloquer la file.
 */
final class QueueConsumer
{
    /** @var array<string, QueueListener> */
    private array $listeners = [];

    /**
     * @param iterable<QueueListener> $listeners
     */
    public function __construct(
        private readonly RabbitMqConnection $connection,
        private readonly ManagerRegistry $doctrine,
        private readonly LoggerInterface $logger,
        #[AutowireIterator(QueueListener::TAG)] iterable $listeners,
    ) {
        foreach ($listeners as $listener) {
            $this->listeners[$listener->queue()] = $listener;
        }
    }

    /**
     * @return list<string> les queues déclarées
     */
    public function declareQueues(): array
    {
        $channel = $this->connection->channel();
        foreach (array_keys($this->listeners) as $queue) {
            // durable : la queue survit au redémarrage du broker
            $channel->queue_declare($queue, false, true, false, false);
        }

        return array_keys($this->listeners);
    }

    /**
     * Écoute les queues jusqu'à $maxMessages messages traités (null : sans fin) ou $idleTimeout secondes sans message.
     *
     * @return int nombre de messages traités
     */
    public function consume(?int $maxMessages = null, ?int $idleTimeout = null): int
    {
        $channel = $this->connection->channel();
        $this->declareQueues();
        $channel->basic_qos(0, 1, false);

        $handled = 0;
        foreach ($this->listeners as $queue => $listener) {
            $channel->basic_consume($queue, '', false, false, false, false, function (AMQPMessage $message) use ($queue, $listener, &$handled): void {
                $this->dispatch($queue, $listener, $message);
                ++$handled;
            });
        }

        while ($channel->is_consuming() && (null === $maxMessages || $handled < $maxMessages)) {
            try {
                $channel->wait(null, false, $idleTimeout ?? 0);
            } catch (AMQPTimeoutException) {
                break;
            }
        }

        return $handled;
    }

    /**
     * @return list<string>
     */
    public function queues(): array
    {
        return array_keys($this->listeners);
    }

    private function dispatch(string $queue, QueueListener $listener, AMQPMessage $message): void
    {
        try {
            $payload = json_decode($message->getBody(), true, 512, \JSON_THROW_ON_ERROR);
            $this->logger->info('Message reçu depuis la queue {queue}', ['queue' => $queue, 'payload' => $payload]);
            $listener->handle($payload);
            $message->ack();
        } catch (\Throwable $e) {
            $retry = !$message->isRedelivered();
            $this->logger->error('Échec du traitement d\'un message de la queue {queue} ({action}) : {error}', [
                'queue' => $queue,
                'action' => $retry ? 'remis dans la queue' : 'écarté',
                'error' => $e->getMessage(),
                'body' => $message->getBody(),
            ]);
            $message->nack($retry);
        } finally {
            // Processus long : on repart d'un gestionnaire d'entités propre pour chaque message
            $manager = $this->doctrine->getManager();
            if (method_exists($manager, 'isOpen') && !$manager->isOpen()) {
                $this->doctrine->resetManager();
            } else {
                $manager->clear();
            }
        }
    }
}
