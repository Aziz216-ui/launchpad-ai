import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommentairesService } from '../services/commentaires.service';
import { CreerCommentaireDto } from '../dto/creer-commentaire.dto';
import { Commentaire } from '../../database/entities/commentaire.entity';

// Monté à la racine du préfixe global : toutes les routes commencent par /api/commentaires
@ApiTags('Commentaires')
@Controller()
export class CommentairesController {
  constructor(private readonly commentairesService: CommentairesService) {}

  @Post()
  @ApiOperation({ summary: 'Ajouter un commentaire sur un document juridique' })
  @ApiResponse({ status: 201, description: 'Commentaire enregistré', type: Commentaire })
  async creer(@Body() dto: CreerCommentaireDto): Promise<Commentaire> {
    return this.commentairesService.creer(dto);
  }

  @Get('documents/:documentId')
  @ApiOperation({ summary: 'Lister les commentaires d’un document (ordre chronologique)' })
  @ApiParam({ name: 'documentId', description: 'UUID du document juridique' })
  @ApiResponse({ status: 200, description: 'Liste des commentaires', type: [Commentaire] })
  async findByDocument(
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
  ): Promise<Commentaire[]> {
    return this.commentairesService.findByDocument(documentId);
  }

  @Delete('documents/:documentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer tous les commentaires d’un document' })
  @ApiParam({ name: 'documentId', description: 'UUID du document juridique' })
  @ApiResponse({ status: 200, description: 'Nombre de commentaires supprimés' })
  async supprimerParDocument(
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
  ): Promise<{ supprimes: number }> {
    return this.commentairesService.supprimerParDocument(documentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulter un commentaire par son identifiant' })
  @ApiParam({ name: 'id', description: 'UUID du commentaire' })
  @ApiResponse({ status: 200, description: 'Commentaire trouvé', type: Commentaire })
  @ApiResponse({ status: 404, description: 'Commentaire introuvable' })
  async findById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<Commentaire> {
    return this.commentairesService.findById(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un commentaire' })
  @ApiParam({ name: 'id', description: 'UUID du commentaire' })
  @ApiResponse({ status: 204, description: 'Commentaire supprimé' })
  @ApiResponse({ status: 404, description: 'Commentaire introuvable' })
  async supprimer(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.commentairesService.supprimer(id);
  }
}
