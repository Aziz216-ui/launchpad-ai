import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3003);
  const globalPrefix = configService.get<string>(
    'GLOBAL_PREFIX',
    'api/legal',
  );

  // Le CORS est géré en amont par l'API Gateway (règle 3 de la gateway)
  // app.enableCors(); désactivé

  // Préfixe global d'API : toutes les routes commencent par /api/legal
  app.setGlobalPrefix(globalPrefix);

  // Validation globale stricte avec class-validator
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

  // Filtre d'exception global avec format d'erreur uniforme
  app.useGlobalFilters(new HttpExceptionFilter());

  // Configuration Swagger / OpenAPI à /api/legal/docs et /api/legal/docs-json
  const swaggerConfig = new DocumentBuilder()
    .setTitle('LaunchPad - Microservice Gestion Juridique')
    .setDescription(
      'API REST pour la gestion et la vérification des documents juridiques (Statuts, Contrats, NDA, PV), ' +
        'le workflow de validation par les avocats, la gestion des clauses et la signature électronique.',
    )
    .setVersion('1.0.0')
    .addTag('Gestion des documents', 'Création, modification, archivage et export PDF des documents juridiques')
    .addTag('Vérification par avocat', 'Revue légale, amendement de clauses, acceptation, rejet et signature')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/legal/docs', app, document, {
    jsonDocumentUrl: 'api/legal/docs-json',
    swaggerOptions: {
      docExpansion: 'list',
      filter: true,
    },
    customSiteTitle: 'Documentation API Juridique - LaunchPad',
  });

  // Active les shutdown hooks pour le désenregistrement propre auprès d'Eureka
  app.enableShutdownHooks();

  await app.listen(port);

  logger.log(`🚀 Microservice juridique démarré avec succès sur le port ${port}`);
  logger.log(`📚 Documentation Swagger accessible sur : http://localhost:${port}/api/legal/docs`);
  logger.log(`📄 Spécification JSON Swagger accessible sur : http://localhost:${port}/api/legal/docs-json`);
  logger.log(`🔗 API Base URL : http://localhost:${port}/${globalPrefix}`);
}

bootstrap();
