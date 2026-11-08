import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClausesService } from '../services/clauses.service';
import { CreerClauseDto } from '../dto/creer-clause.dto';
import { CreerClausesDto } from '../dto/creer-clauses.dto';
import { ModifierClauseDto } from '../dto/modifier-clause.dto';
import { Clause } from '../../database/entities/clause.entity';

// Monté à la racine du préfixe global : toutes les routes commencent par /api/clauses
@ApiTags('Clauses')
@Controller()
export class ClausesController {
  constructor(private readonly clausesService: ClausesService) {}

  @Post()
  @ApiOperation({ summary: 'Créer une clause pour un document' })
  @ApiResponse({ status: 201, description: 'Clause créée', type: Clause })
  @ApiResponse({ status: 409, description: 'Ce numéro de clause existe déjà pour le document' })
  async creer(@Body() dto: CreerClauseDto): Promise<Clause> {
    return this.clausesService.creer(dto);
  }

  @Post('bulk')
  @ApiOperation({
    summary: 'Créer toutes les clauses d’un document en une fois',
    description: 'Utilisé par le Legal-Service lors de la génération d’un document.',
  })
  @ApiResponse({ status: 201, description: 'Clauses créées', type: [Clause] })
  async creerEnMasse(@Body() dto: CreerClausesDto): Promise<Clause[]> {
    return this.clausesService.creerEnMasse(dto);
  }

  @Get('documents/:documentId')
  @ApiOperation({ summary: 'Lister les clauses d’un document (triées par numéro)' })
  @ApiParam({ name: 'documentId', description: 'UUID du document juridique' })
  @ApiResponse({ status: 200, description: 'Liste des clauses', type: [Clause] })
  async findByDocument(
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
  ): Promise<Clause[]> {
    return this.clausesService.findByDocument(documentId);
  }

  @Get('documents/:documentId/:numero')
  @ApiOperation({ summary: 'Consulter une clause par son numéro' })
  @ApiParam({ name: 'documentId', description: 'UUID du document juridique' })
  @ApiParam({ name: 'numero', description: 'Numéro d’ordre de la clause' })
  @ApiResponse({ status: 200, description: 'Clause trouvée', type: Clause })
  @ApiResponse({ status: 404, description: 'Clause introuvable' })
  async findOne(
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Param('numero', ParseIntPipe) numero: number,
  ): Promise<Clause> {
    return this.clausesService.findOne(documentId, numero);
  }

  @Patch('documents/:documentId/:numero')
  @ApiOperation({ summary: 'Modifier le texte et/ou le titre d’une clause' })
  @ApiParam({ name: 'documentId', description: 'UUID du document juridique' })
  @ApiParam({ name: 'numero', description: 'Numéro d’ordre de la clause' })
  @ApiResponse({ status: 200, description: 'Clause mise à jour', type: Clause })
  @ApiResponse({ status: 404, description: 'Clause introuvable' })
  async modifier(
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Param('numero', ParseIntPipe) numero: number,
    @Body() dto: ModifierClauseDto,
  ): Promise<Clause> {
    return this.clausesService.modifier(documentId, numero, dto);
  }

  @Delete('documents/:documentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer toutes les clauses d’un document' })
  @ApiParam({ name: 'documentId', description: 'UUID du document juridique' })
  @ApiResponse({ status: 200, description: 'Nombre de clauses supprimées' })
  async supprimerParDocument(
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
  ): Promise<{ supprimees: number }> {
    return this.clausesService.supprimerParDocument(documentId);
  }
}
