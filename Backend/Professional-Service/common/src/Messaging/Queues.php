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

    /**
     * client-file-service, document-service → message-service : activité sur un dossier à signaler à l'autre
     * participant (nouvelle demande, demande acceptée / refusée, dossier clôturé, document déposé).
     * Devient un message automatique du fil, donc une notification sous la cloche du destinataire.
     */
    public const MESSAGE_FILE_ACTIVITY = 'message.file_activity';

    /**
     * User-Service → workspace-service : un utilisateur s'est inscrit avec le rôle ACCOUNTANT.
     * Nom partagé avec Backend/User-Service/authentication/events.py (ACCOUNTANT_REGISTERED_QUEUE).
     */
    public const WORKSPACE_ACCOUNTANT_REGISTERED = 'workspace.accountant_registered';
}
