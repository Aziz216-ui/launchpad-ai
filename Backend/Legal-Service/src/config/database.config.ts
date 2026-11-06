import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DocumentJuridique } from '../database/entities/document-juridique.entity';

export const getDatabaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('DB_HOST', 'localhost'),
  port: configService.get<number>('DB_PORT', 5432),
  username: configService.get<string>('DB_USERNAME', 'postgres'),
  password: configService.get<string>('DB_PASSWORD', 'postgres'),
  database: configService.get<string>('DB_NAME', 'legal_db'),
  entities: [DocumentJuridique],
  synchronize: configService.get<string>('DB_SYNCHRONIZE', 'true') === 'true',
  logging: configService.get<string>('DB_LOGGING', 'false') === 'true',
});
