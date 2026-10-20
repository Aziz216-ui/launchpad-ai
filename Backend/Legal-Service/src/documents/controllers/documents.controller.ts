import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Res,
  ParseIntPipe,
  ParseUUIDPipe,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { GenerateurJuridiqueService } from '../services/generateur-juridique.service';
import { GestionnaireDocsJuridiquesService } from '../services/gestionnaire-docs-juridiques.service';
import { WorkflowSignatureService } from '../services/workflow-signature.service';
import { GenerateDocumentDto } from '../dto/generate-document.dto';
import { ModifierDocumentDto } from '../dto/modifier-document.dto';
import { ChangerStatutDto } from '../dto/changer-statut.dto';
import { ValidationRequestDto } from '../dto/validation-request.dto';
import { ModifierClauseDto } from '../dto/modifier-clause.dto';
import { DemanderSignatureDto } from '../dto/demander-signature.dto';
import { FilterDocumentsDto } from '../dto/filter-documents.dto';
import { DocumentJuridique } from '../../database/entities/document-juridique.entity';
import { Clause } from '../../database/entities/clause.entity';
import { Commentaire } from '../../database/entities/commentaire.entity';

@ApiTags('Gestion des documents')
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly generateurService: GenerateurJuridiqueService,
    private readonly gestionnaireService: GestionnaireDocsJuridiquesService,
    private readonly signatureService: WorkflowSignatureService,
  ) {}

  @Post('generate')
  @ApiOperation({
    summary: 'Générer un document juridique (STATUTS, CONTRAT, NDA, PV)',
    description:
      'Génère automatiquement un document à l’état BROUILLON avec un jeu de clauses types pré-remplies selon les paramètres.',
  })
  @ApiResponse({
    status: 201,
    description: 'Document créé avec succès en statut BROUILLON',
    type: DocumentJuridique,
  })
  async generate(@Body() dto: GenerateDocumentDto): Promise<DocumentJuridique> {
    return this.generateurService.generer(dto.type, dto.projetId, dto.params);
  }

  @Get()
  @ApiOperation({
    summary: 'Lister les documents juridiques',
    description: 'Filtre optionnel par projetId, type ou statut.',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des documents juridiques',
    type: [DocumentJuridique],
  })
  async list(@Query() filters: FilterDocumentsDto): Promise<DocumentJuridique[]> {
    return this.gestionnaireService.list(filters);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consulter un document juridique par son identifiant',
  })
  @ApiParam({ name: 'id', description: 'UUID du document' })
  @ApiResponse({
    status: 200,
    description: 'Détails du document juridique',
    type: DocumentJuridique,
  })
  @ApiResponse({ status: 404, description: 'Document introuvable' })
  async findById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<DocumentJuridique> {
    return this.gestionnaireService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Modifier les informations générales d’un document juridique',
    description:
      'Met à jour le titre et/ou métadonnées et incrémente automatiquement la version.',
  })
  @ApiParam({ name: 'id', description: 'UUID du document' })
  @ApiResponse({
    status: 200,
    description: 'Document mis à jour',
    type: DocumentJuridique,
  })
  @ApiResponse({
    status: 409,
    description: 'Conflit si le document est archivé (lecture seule)',
  })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ModifierDocumentDto,
  ): Promise<DocumentJuridique> {
    return this.gestionnaireService.modifierDocument(id, dto);
  }

  @Get(':id/export')
  @ApiOperation({
    summary: 'Exporter le document juridique au format PDF',
    description: 'Génère et télécharge le fichier PDF mis en page.',
  })
  @ApiParam({ name: 'id', description: 'UUID du document' })
  @ApiQuery({
    name: 'format',
    required: false,
    example: 'pdf',
    description: 'Format souhaité (défaut: pdf)',
  })
  async exportPDF(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() res: Response,
  ) {
    const { filename, buffer } = await this.gestionnaireService.exporterPDF(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });

    res.status(HttpStatus.OK).send(buffer);
  }

  @Post(':id/archive')
  @ApiOperation({
    summary: 'Archiver un document juridique',
    description:
      'Passe le document en mode archivé (lecture seule permanente).',
  })
  @ApiParam({ name: 'id', description: 'UUID du document' })
  @ApiResponse({
    status: 200,
    description: 'Document archivé avec succès',
    type: DocumentJuridique,
  })
  async archive(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<DocumentJuridique> {
    return this.gestionnaireService.archiver(id);
  }

  @Post(':id/validation-requests')
  @ApiOperation({
    summary: 'Envoyer le document pour vérification juridique par un avocat',
    description:
      'Bascule le document de BROUILLON à EN_VALIDATION et émet l’événement document.validation.requested.',
  })
  @ApiParam({ name: 'id', description: 'UUID du document' })
  @ApiResponse({
    status: 200,
    description: 'Demande de validation soumise',
    type: DocumentJuridique,
  })
  @ApiResponse({
    status: 409,
    description: 'Le document n’est pas au statut BROUILLON ou est archivé',
  })
  async submitForValidation(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ValidationRequestDto,
  ): Promise<DocumentJuridique> {
    return this.gestionnaireService.envoyerPourValidation(id, dto.clientId);
  }

  @Post(':id/status')
  @ApiOperation({
    summary: 'Changer le statut d’un document selon la machine à états',
    description:
      'Applique les transitions autorisées (BROUILLON -> EN_VALIDATION -> VALIDE/REFUSE -> SIGNE). Toute autre transition renvoie 409 Conflict.',
  })
  @ApiParam({ name: 'id', description: 'UUID du document' })
  @ApiResponse({
    status: 200,
    description: 'Statut mis à jour avec succès',
    type: DocumentJuridique,
  })
  @ApiResponse({
    status: 409,
    description: 'Transition d’état interdite par la machine à états',
  })
  async changeStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ChangerStatutDto,
  ): Promise<DocumentJuridique> {
    return this.gestionnaireService.changerStatut(id, dto.statut, dto.motif);
  }

  @Get(':id/clauses')
  @ApiOperation({
    summary: 'Lister toutes les clauses d’un document juridique',
  })
  @ApiParam({ name: 'id', description: 'UUID du document' })
  @ApiResponse({
    status: 200,
    description: 'Liste des clauses ordonnées par numéro',
    type: [Clause],
  })
  async getClauses(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<Clause[]> {
    return this.gestionnaireService.getClauses(id);
  }

  @Patch(':id/clauses/:numero')
  @ApiOperation({
    summary: 'Modifier le contenu d’une clause spécifique',
    description:
      'Met à jour le texte de la clause et incrémente automatiquement la version du document.',
  })
  @ApiParam({ name: 'id', description: 'UUID du document' })
  @ApiParam({ name: 'numero', description: 'Numéro d’ordre de la clause' })
  @ApiResponse({
    status: 200,
    description: 'Clause mise à jour avec succès',
    type: Clause,
  })
  async updateClause(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('numero', ParseIntPipe) numero: number,
    @Body() dto: ModifierClauseDto,
  ): Promise<Clause> {
    return this.gestionnaireService.modifierClause(
      id,
      numero,
      dto.texte,
      dto.titre,
    );
  }

  @Post(':id/signatures')
  @ApiOperation({
    summary: 'Demander la signature électronique du document',
    description:
      'Possible uniquement si le document est au statut VALIDE. Déclenche l’événement document.signature.requested.',
  })
  @ApiParam({ name: 'id', description: 'UUID du document' })
  @ApiResponse({
    status: 200,
    description: 'Demande de signature initiée avec succès',
    type: DocumentJuridique,
  })
  @ApiResponse({
    status: 409,
    description: 'Le document n’est pas au statut VALIDE ou est archivé',
  })
  async requestSignature(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DemanderSignatureDto,
  ): Promise<DocumentJuridique> {
    return this.signatureService.demanderSignature(id, dto.signataires);
  }

  @Get(':id/signatures/status')
  @ApiOperation({
    summary: 'Consulter le statut d’avancement des signatures d’un document',
  })
  @ApiParam({ name: 'id', description: 'UUID du document' })
  @ApiResponse({
    status: 200,
    description: 'Statut du cycle de signature',
  })
  async getSignatureStatus(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.signatureService.getStatutSignature(id);
  }

  @Get(':id/comments')
  @ApiOperation({
    summary: 'Lister les commentaires et observations d’un document',
  })
  @ApiParam({ name: 'id', description: 'UUID du document' })
  @ApiResponse({
    status: 200,
    description: 'Liste des commentaires',
    type: [Commentaire],
  })
  async getComments(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<Commentaire[]> {
    return this.gestionnaireService.getCommentaires(id);
  }
}
