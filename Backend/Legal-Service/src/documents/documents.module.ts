import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentJuridique } from '../database/entities/document-juridique.entity';
import { Clause } from '../database/entities/clause.entity';
import { Commentaire } from '../database/entities/commentaire.entity';
import { DocumentsController } from './controllers/documents.controller';
import { GenerateurJuridiqueService } from './services/generateur-juridique.service';
import { GestionnaireDocsJuridiquesService } from './services/gestionnaire-docs-juridiques.service';
import { WorkflowSignatureService } from './services/workflow-signature.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentJuridique, Clause, Commentaire]),
  ],
  controllers: [DocumentsController],
  providers: [
    GenerateurJuridiqueService,
    GestionnaireDocsJuridiquesService,
    WorkflowSignatureService,
  ],
  exports: [
    GenerateurJuridiqueService,
    GestionnaireDocsJuridiquesService,
    WorkflowSignatureService,
  ],
})
export class DocumentsModule {}
