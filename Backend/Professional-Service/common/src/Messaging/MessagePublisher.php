<?php

namespace Launchpad\Common\Messaging;

use Launchpad\Common\Messaging\Message\QueueMessage;

/**
 * Publication d'un message sur une queue (équivalent de RabbitTemplate.convertAndSend de l'atelier).
 */
interface MessagePublisher
{
    /**
     * @throws MessagingException broker injoignable ou queue inexistante
     */
    public function publish(string $queue, QueueMessage $message): void;
}
