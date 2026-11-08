import { Global, Module } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';
import { DocumentEventsPublisher } from './document-events.publisher';
import { ServicesEventsConsumer } from './services-events.consumer';

@Global()
@Module({
  providers: [RabbitMQService, DocumentEventsPublisher, ServicesEventsConsumer],
  exports: [RabbitMQService],
})
export class MessagingModule {}
