import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';

// Suivi des événements publiés par Clause-Service et Commentaire-Service
@Injectable()
export class ServicesEventsConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(ServicesEventsConsumer.name);

  constructor(private readonly rabbitMQService: RabbitMQService) {}

  async onApplicationBootstrap() {
    await this.rabbitMQService.subscribe(
      'legal-service.events',
      ['clause.*', 'commentaire.*'],
      (payload: { documentId?: string }, routingKey) => {
        this.logger.log(
          `Événement reçu : ${routingKey} (document ${payload.documentId ?? 'inconnu'})`,
        );
      },
    );
  }
}
