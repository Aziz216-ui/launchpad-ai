<?php

namespace Launchpad\Common\Messaging;

/**
 * Noms des queues RabbitMQ partagés entre producteurs et consommateurs.
 *
 * Comme dans l'atelier (CANDID_JOB_QUEUE) : le consommateur déclare la queue,
 * le producteur se contente de publier en utilisant son nom.
 */
final class Queues
{
    /** workspace-service → client-file-service : un espace comptable a été activé / désactivé. */
    public const CLIENT_FILE_WORKSPACE_STATUS = 'client_file.workspace_status';

    /** document-service → message-service : un comptable a validé / rejeté un document. */
    public const MESSAGE_DOCUMENT_DECIDED = 'message.document_decided';
}
