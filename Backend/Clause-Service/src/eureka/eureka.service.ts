import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Eureka } from 'eureka-js-client';

@Injectable()
export class EurekaService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(EurekaService.name);
  private client: Eureka | null = null;
  private isEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isEnabled = this.configService.get<string>('EUREKA_ENABLED', 'true') === 'true';

    if (!this.isEnabled) {
      this.logger.warn('Eureka registration is disabled via EUREKA_ENABLED=false');
      return;
    }

    const appName = this.configService
      .get<string>('EUREKA_APP_NAME', 'CLAUSE-SERVICE')
      .toUpperCase();
    const servicePort = Number(this.configService.get<number>('PORT', 3004));
    const serviceHost = this.configService.get<string>('EUREKA_CLIENT_HOST', 'localhost');
    const globalPrefix = this.configService.get<string>('GLOBAL_PREFIX', 'api/clauses');
    const serviceIp = this.configService.get<string>('EUREKA_CLIENT_IP', '127.0.0.1');

    const eurekaHost = this.configService.get<string>('EUREKA_HOST', 'localhost');
    const eurekaPort = Number(this.configService.get<number>('EUREKA_PORT', 8761));
    const eurekaServicePath = this.configService.get<string>(
      'EUREKA_SERVICE_PATH',
      '/eureka/apps/',
    );

    this.client = new Eureka({
      instance: {
        app: appName,
        hostName: serviceHost,
        ipAddr: serviceIp,
        statusPageUrl: `http://${serviceHost}:${servicePort}/${globalPrefix}/docs`,
        port: {
          $: servicePort,
          '@enabled': true,
        },
        vipAddress: appName,
        dataCenterInfo: {
          '@class': 'com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo',
          name: 'MyOwn',
        },
      },
      eureka: {
        host: eurekaHost,
        port: eurekaPort,
        servicePath: eurekaServicePath,
        maxRetries: 10,
        requestRetryDelay: 2000,
        registryFetchInterval: 30000,
      },
    });
  }

  onApplicationBootstrap() {
    if (!this.isEnabled || !this.client) {
      return;
    }

    this.logger.log('Démarrage de l\'enregistrement auprès d\'Eureka...');
    this.client.start((error: Error | null) => {
      if (error) {
        this.logger.warn(
          `⚠️ Impossible de s'enregistrer auprès d'Eureka (${error.message}). Vérifiez si Eureka est lancé sur le port 8761.`,
        );
      } else {
        this.logger.log(
          `✅ Service enregistré avec succès auprès d'Eureka sous le nom: ${this.configService.get<string>(
            'EUREKA_APP_NAME',
            'CLAUSE-SERVICE',
          )}`,
        );
      }
    });
  }

  onApplicationShutdown(signal?: string) {
    if (!this.isEnabled || !this.client) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      this.logger.log(`Arrêt de l'instance (${signal || 'SHUTDOWN'}) et désenregistrement d'Eureka...`);
      this.client!.stop((error: Error | null) => {
        if (error) {
          this.logger.error('Erreur lors du désenregistrement d\'Eureka:', error.message);
        } else {
          this.logger.log('✅ Désenregistrement d\'Eureka effectué.');
        }
        resolve();
      });
    });
  }

  getClient(): Eureka | null {
    return this.client;
  }
}
