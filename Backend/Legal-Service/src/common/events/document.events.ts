import { DocumentStatut } from '../enums/document-statut.enum';
import { DocumentType } from '../enums/document-type.enum';

export const DOCUMENT_EVENTS = {
  VALIDATION_REQUESTED: 'document.validation.requested',
  STATUS_CHANGED: 'document.status.changed',
  ACCEPTED: 'document.accepted',
  REJECTED: 'document.rejected',
  SIGNATURE_REQUESTED: 'document.signature.requested',
  SIGNED: 'document.signed',
  INFO_REQUESTED: 'document.info.requested',
  ARCHIVED: 'document.archived',
  MODIFIED: 'document.modified',
};

export class DocumentValidationRequestedEvent {
  constructor(
    public readonly documentId: string,
    public readonly clientId: string,
    public readonly projetId: string,
    public readonly type: DocumentType,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class DocumentStatusChangedEvent {
  constructor(
    public readonly documentId: string,
    public readonly previousStatut: DocumentStatut,
    public readonly nouveauStatut: DocumentStatut,
    public readonly projetId: string,
    public readonly motif?: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class DocumentSignatureRequestedEvent {
  constructor(
    public readonly documentId: string,
    public readonly signataires: string[],
    public readonly projetId: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class DocumentSignedEvent {
  constructor(
    public readonly documentId: string,
    public readonly signataire: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class DocumentInfoRequestedEvent {
  constructor(
    public readonly documentId: string,
    public readonly question: string,
    public readonly avocat: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

export class DocumentArchivedEvent {
  constructor(
    public readonly documentId: string,
    public readonly projetId: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}
