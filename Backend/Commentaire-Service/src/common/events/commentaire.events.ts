// Clés de routage RabbitMQ (exchange topic partagé)
export const COMMENTAIRE_EVENTS = {
  CREATED: 'commentaire.created',
  DELETED: 'commentaire.deleted',
};

// Événements publiés par le Legal-Service et consommés ici
export const DOCUMENT_EVENTS = {
  DELETED: 'document.deleted',
};

export interface CommentaireCreatedEvent {
  commentaireId: string;
  documentId: string;
  auteur: string;
  timestamp: Date;
}

// commentaireId absent lorsque tous les commentaires du document sont supprimés
export interface CommentairesDeletedEvent {
  documentId: string;
  commentaireId?: string;
  supprimes: number;
  timestamp: Date;
}

export interface DocumentDeletedEvent {
  documentId: string;
  projetId: string;
  timestamp: string;
}
