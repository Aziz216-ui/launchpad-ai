import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { VerificationAvocatService } from '../services/verification-avocat.service';
import { AjouterCommentaireDto } from '../dto/ajouter-commentaire.dto';
import { RefuserDocumentDto } from '../dto/refuser-document.dto';
import { DemanderInformationsDto } from '../dto/demander-informations.dto';
import { SignerDocumentDto } from '../dto/signer-document.dto';
import { ModifierClauseDto } from '../../documents/dto/modifier-clause.dto';
import { DocumentJuridique } from '../../database/entities/document-juridique.entity';
import { Clause } from '../../database/entities/clause.entity';
import { Commentaire } from '../../database/entities/commentaire.entity';

@ApiTags('Vérification par avocat')
@Controller('verification')
export class VerificationController {
  constructor(
    private readonly verificationService: VerificationAvocatService,
  ) {}

  @Get('documents/:id')
  @ApiOperation({
    summary: 'Consulter un document soumis pour vérification',
    description:
      'Permet d’examiner l’intégralité des clauses, paramètres et commentaires du document.',
  })
  @ApiParam({ name: 'id', description: 'UUID du document' })
  @ApiResponse({
    status: 200,
    description: 'Document complet pour revue juridique',
    type: DocumentJuridique,
  })
  @ApiResponse({ status: 404, description: 'Document introuvable' })
  async consulterDocument(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<DocumentJuridique> {
    return this.verificationService.consulterDocument(id);
  }

  @Patch('documents/:id/clauses/:numero')
  @ApiOperation({
    summary: 'Modifier ou ajuster une clause juridique',
    description:
      'Adapte la clause et incrémente automatiquement la version du document.',
  })
  @ApiParam({ name: 'id', description: 'UUID du document' })
  @ApiParam({ name: 'numero', description: 'Numéro de la clause' })
  @ApiResponse({
    status: 200,
    description: 'Clause modifiée avec succès',
    type: Clause,
  })
  async modifierClause(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('numero', ParseIntPipe) numero: number,
    @Body() dto: ModifierClauseDto,
  ): Promise<Clause> {
    return this.verificationService.modifierClause(id, numero, dto.texte);
  }

  @Post('documents/:id/comments')
  @ApiOperation({
    summary: 'Ajouter une observation ou remarque juridique',
  })
  @ApiParam({ name: 'id', description: 'UUID du document' })
  @ApiResponse({
    status: 201,
    description: 'Commentaire enregistré avec succès',
    type: Commentaire,
  })
  async ajouterCommentaire(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: AjouterCommentaireDto,
  ): Promise<Commentaire> {
    const auteur = dto.auteur || 'Avocat';
    return this.verificationService.ajouterCommentaire(id, dto.texte, auteur);
  }

  @Post('documents/:id/accept')
  @ApiOperation({
    summary: 'Valider et certifier le document juridique',
    description:
      'Fait passer le document de EN_VALIDATION à VALIDE. Émet un événement de changement de statut.',
  })
  @ApiParam({ name: 'id', description: 'UUID du document' })
  @ApiResponse({
    status: 200,
    description: 'Document validé avec succès',
    type: DocumentJuridique,
  })
  @ApiResponse({
    status: 409,
    description: 'Le statut actuel n’est pas EN_VALIDATION',
  })
  async accepter(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<DocumentJuridique> {
    return this.verificationService.accepter(id);
  }

  @Post('documents/:id/reject')
  @ApiOperation({
    summary: 'Refuser le document juridique avec motif',
    description:
      'Fait passer le document de EN_VALIDATION à REFUSE (motif requis). Émet un événement.',
  })
  @ApiParam({ name: 'id', description: 'UUID du document' })
  @ApiResponse({
    status: 200,
    description: 'Document refusé avec motif enregistré',
    type: DocumentJuridique,
  })
  @ApiResponse({
    status: 400,
    description: 'Le motif de refus est obligatoire',
  })
  @ApiResponse({
    status: 409,
    description: 'Le statut actuel n’est pas EN_VALIDATION',
  })
  async refuser(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RefuserDocumentDto,
  ): Promise<DocumentJuridique> {
    return this.verificationService.refuser(id, dto.motif);
  }

  @Post('documents/:id/info-requests')
  @ApiOperation({
    summary: 'Demander des informations complémentaires au client',
    description:
      'Émet l’événement document.info.requested et consigne la question dans l’historique des commentaires.',
  })
  @ApiParam({ name: 'id', description: 'UUID du document' })
  @ApiResponse({
    status: 200,
    description: 'Demande d’informations émise',
    type: DocumentJuridique,
  })
  async demanderInformations(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: DemanderInformationsDto,
  ): Promise<DocumentJuridique> {
    const avocatName = dto.avocat || 'Avocat';
    return this.verificationService.demanderInformations(
      id,
      dto.question,
      avocatName,
    );
  }

  @Post('documents/:id/sign')
  @ApiOperation({
    summary: 'Apposer la signature électronique',
    description:
      'Autorisé uniquement depuis le statut VALIDE. Fait passer le document à SIGNE.',
  })
  @ApiParam({ name: 'id', description: 'UUID du document' })
  @ApiResponse({
    status: 200,
    description: 'Document signé avec succès',
    type: DocumentJuridique,
  })
  @ApiResponse({
    status: 409,
    description: 'La signature est permise uniquement si le document est VALIDE',
  })
  async signer(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto?: SignerDocumentDto,
  ): Promise<DocumentJuridique> {
    const avocatName = dto?.avocat || 'Avocat Partenaire';
    return this.verificationService.signer(id, avocatName);
  }
}
