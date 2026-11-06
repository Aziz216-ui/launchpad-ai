import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Commentaire } from '../database/entities/commentaire.entity';
import { CommentairesController } from './controllers/commentaires.controller';
import { CommentairesService } from './services/commentaires.service';

@Module({
  imports: [TypeOrmModule.forFeature([Commentaire])],
  controllers: [CommentairesController],
  providers: [CommentairesService],
  exports: [CommentairesService],
})
export class CommentairesModule {}
