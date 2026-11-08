import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Commentaire } from '../database/entities/commentaire.entity';
import { CommentairesController } from './controllers/commentaires.controller';
import { CommentairesService } from './services/commentaires.service';
import { DocumentDeletedConsumer } from './consumers/document-deleted.consumer';

@Module({
  imports: [TypeOrmModule.forFeature([Commentaire])],
  controllers: [CommentairesController],
  providers: [CommentairesService, DocumentDeletedConsumer],
  exports: [CommentairesService],
})
export class CommentairesModule {}
