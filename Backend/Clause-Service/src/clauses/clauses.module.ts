import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clause } from '../database/entities/clause.entity';
import { ClausesController } from './controllers/clauses.controller';
import { ClausesService } from './services/clauses.service';
import { DocumentDeletedConsumer } from './consumers/document-deleted.consumer';

@Module({
  imports: [TypeOrmModule.forFeature([Clause])],
  controllers: [ClausesController],
  providers: [ClausesService, DocumentDeletedConsumer],
  exports: [ClausesService],
})
export class ClausesModule {}
