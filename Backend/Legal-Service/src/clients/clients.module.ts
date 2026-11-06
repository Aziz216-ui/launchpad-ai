import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ClauseClient } from './clause.client';
import { CommentaireClient } from './commentaire.client';

// Clients HTTP vers les microservices Clause-Service et Commentaire-Service
@Module({
  imports: [HttpModule.register({ timeout: 5000 })],
  providers: [ClauseClient, CommentaireClient],
  exports: [ClauseClient, CommentaireClient],
})
export class ClientsModule {}
