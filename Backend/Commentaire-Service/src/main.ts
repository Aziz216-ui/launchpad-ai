import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as client from 'prom-client';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Métriques Prometheus, exposées hors du préfixe global (scrapées sur /metrics)
  client.collectDefaultMetrics();
  app.getHttpAdapter().get('/metrics', async (_req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3005);
  const globalPrefix = configService.get<string>(
    'GLOBAL_PREFIX',
    'api/commentaires',
  );

  // Le CORS est géré en amont par l'API Gateway
  app.setGlobalPrefix(globalPrefix);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('LaunchPad - Microservice Commentaires')
    .setDescription(
      'API REST de gestion des commentaires et observations laissés sur les documents juridiques.',
    )
    .setVersion('1.0.0')
    .addTag('Commentaires', 'Commentaires rattachés aux documents du Legal-Service')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${globalPrefix}/docs`, app, document, {
    jsonDocumentUrl: `${globalPrefix}/docs-json`,
    swaggerOptions: {
      docExpansion: 'list',
      filter: true,
    },
    customSiteTitle: 'Documentation API Commentaires - LaunchPad',
  });

  // Active les shutdown hooks pour le désenregistrement propre auprès d'Eureka
  app.enableShutdownHooks();

  await app.listen(port);

  logger.log(`🚀 Microservice commentaires démarré avec succès sur le port ${port}`);
  logger.log(`📚 Documentation Swagger accessible sur : http://localhost:${port}/${globalPrefix}/docs`);
  logger.log(`🔗 API Base URL : http://localhost:${port}/${globalPrefix}`);
}

bootstrap();
