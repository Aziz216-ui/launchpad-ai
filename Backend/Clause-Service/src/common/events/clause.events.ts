// Clés de routage RabbitMQ (exchange topic partagé)
export const CLAUSE_EVENTS = {
  CREATED: 'clause.created',
  MODIFIED: 'clause.modified',
  DELETED: 'clause.deleted',
};

// Événements publiés par le Legal-Service et consommés ici
export const DOCUMENT_EVENTS = {
  DELETED: 'document.deleted',
};

export interface ClausesCreatedEvent {
  documentId: string;
  numeros: number[];
  timestamp: Date;
}

export interface ClauseModifiedEvent {
  documentId: string;
  numero: number;
  timestamp: Date;
}

export interface ClausesDeletedEvent {
  documentId: string;
  supprimees: number;
  timestamp: Date;
}

export interface DocumentDeletedEvent {
  documentId: string;
  projetId: string;
  timestamp: string;
}
