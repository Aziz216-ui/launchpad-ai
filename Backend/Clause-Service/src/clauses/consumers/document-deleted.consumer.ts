import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { RabbitMQService } from '../../messaging/rabbitmq.service';
import {
  DOCUMENT_EVENTS,
  DocumentDeletedEvent,
} from '../../common/events/clause.events';
import { ClausesService } from '../services/clauses.service';

// Supprime les clauses d'un document supprimé dans le Legal-Service
@Injectable()
export class DocumentDeletedConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(DocumentDeletedConsumer.name);

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly clausesService: ClausesService,
  ) {}

  async onApplicationBootstrap() {
    await this.rabbitMQService.subscribe(
      'clause-service.document-deleted',
      [DOCUMENT_EVENTS.DELETED],
      async (event: DocumentDeletedEvent) => {
        this.logger.log(`document.deleted reçu pour le document ${event.documentId}`);
        await this.clausesService.supprimerParDocument(event.documentId);
      },
    );
  }
}
