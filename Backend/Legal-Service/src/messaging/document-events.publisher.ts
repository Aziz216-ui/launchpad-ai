import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DOCUMENT_EVENTS } from '../common/events/document.events';
import { RabbitMQService } from './rabbitmq.service';

// Relaie chaque événement de domaine interne (EventEmitter2) vers RabbitMQ,
// avec le nom de l'événement comme clé de routage (ex: document.status.changed).
@Injectable()
export class DocumentEventsPublisher implements OnApplicationBootstrap {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  onApplicationBootstrap() {
    for (const eventName of Object.values(DOCUMENT_EVENTS)) {
      this.eventEmitter.on(eventName, (payload: unknown) =>
        this.rabbitMQService.publish(eventName, payload),
      );
    }
  }
}
