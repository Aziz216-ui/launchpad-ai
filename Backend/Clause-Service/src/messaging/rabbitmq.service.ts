import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AmqpConnectionManager,
  ChannelWrapper,
  connect,
} from 'amqp-connection-manager';
import { ConfirmChannel, ConsumeMessage } from 'amqplib';

export type MessageHandler = (
  payload: any,
  routingKey: string,
) => Promise<void> | void;

/**
 * Connexion RabbitMQ partagée par le service.
 * - Un exchange "topic" commun à tous les microservices (RABBITMQ_EXCHANGE).
 * - Reconnexion automatique : les messages publiés pendant une coupure sont
 *   gardés en mémoire puis envoyés au retour du broker.
 * - Un message dont le traitement échoue part dans la file "<queue>.dlq".
 */
@Injectable()
export class RabbitMQService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RabbitMQService.name);
  private readonly isEnabled: boolean;
  private readonly url: string;
  private readonly exchange: string;
  private readonly deadLetterExchange: string;
  private connection: AmqpConnectionManager | null = null;
  private channel: ChannelWrapper | null = null;

  constructor(private readonly configService: ConfigService) {
    this.isEnabled =
      this.configService.get<string>('RABBITMQ_ENABLED', 'true') === 'true';
    this.url = this.configService.get<string>(
      'RABBITMQ_URL',
      'amqp://guest:guest@localhost:5672',
    );
    this.exchange = this.configService.get<string>(
      'RABBITMQ_EXCHANGE',
      'launchpad.events',
    );
    this.deadLetterExchange = `${this.exchange}.dlx`;
  }

  onModuleInit() {
    if (!this.isEnabled) {
      this.logger.warn('RabbitMQ est désactivé via RABBITMQ_ENABLED=false');
      return;
    }

    this.connection = connect([this.url]);
    this.connection.on('connect', () =>
      this.logger.log(`✅ Connecté à RabbitMQ (exchange: ${this.exchange})`),
    );
    // Node renvoie une AggregateError sans message (seul "code" est rempli) pour localhost
    const onError = ({ err }: { err?: NodeJS.ErrnoException }) =>
      this.logger.warn(
        `⚠️ RabbitMQ injoignable (${err?.message || err?.code || 'déconnecté'}). Nouvelle tentative en cours...`,
      );
    this.connection.on('disconnect', onError);
    this.connection.on('connectFailed', onError);

    this.channel = this.connection.createChannel({
      json: true,
      setup: async (channel: ConfirmChannel) => {
        await channel.assertExchange(this.exchange, 'topic', { durable: true });
        await channel.assertExchange(this.deadLetterExchange, 'direct', {
          durable: true,
        });
        await channel.prefetch(10);
      },
    });
  }

  // N'attend pas le broker : en cas de coupure, le message est envoyé à la reconnexion.
  publish(routingKey: string, payload: unknown): void {
    if (!this.channel) {
      return;
    }

    this.channel
      .publish(this.exchange, routingKey, payload, {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now(),
      })
      .then(() => this.logger.debug(`Message publié : ${routingKey}`))
      .catch((error: Error) =>
        this.logger.error(
          `Échec de publication du message ${routingKey} : ${error.message}`,
        ),
      );
  }

  // À appeler depuis onApplicationBootstrap, une fois la connexion créée.
  async subscribe(
    queue: string,
    routingKeys: string[],
    handler: MessageHandler,
  ): Promise<void> {
    if (!this.channel) {
      return;
    }

    const deadLetterQueue = `${queue}.dlq`;

    await this.channel.addSetup(async (channel: ConfirmChannel) => {
      await channel.assertQueue(deadLetterQueue, { durable: true });
      await channel.bindQueue(
        deadLetterQueue,
        this.deadLetterExchange,
        deadLetterQueue,
      );
      await channel.assertQueue(queue, {
        durable: true,
        deadLetterExchange: this.deadLetterExchange,
        deadLetterRoutingKey: deadLetterQueue,
      });
      for (const routingKey of routingKeys) {
        await channel.bindQueue(queue, this.exchange, routingKey);
      }

      await channel.consume(queue, async (message: ConsumeMessage | null) => {
        if (!message) {
          return;
        }
        const routingKey = message.fields.routingKey;
        try {
          const payload = JSON.parse(message.content.toString());
          await handler(payload, routingKey);
          channel.ack(message);
        } catch (error) {
          this.logger.error(
            `Échec du traitement de ${routingKey} (file ${queue}) -> ${deadLetterQueue} : ${(error as Error).message}`,
          );
          channel.nack(message, false, false);
        }
      });
    });

    this.logger.log(
      `File ${queue} abonnée à : ${routingKeys.join(', ')}`,
    );
  }

  async onApplicationShutdown() {
    if (!this.connection) {
      return;
    }
    await this.channel?.close();
    await this.connection.close();
    this.logger.log('Connexion RabbitMQ fermée');
  }
}
