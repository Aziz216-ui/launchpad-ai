import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DocumentStatut } from '../../common/enums/document-statut.enum';

export class ChangerStatutDto {
  @ApiProperty({
    enum: DocumentStatut,
    example: DocumentStatut.EN_VALIDATION,
    description: 'Nouveau statut cible du document',
  })
  @IsEnum(DocumentStatut, {
    message: 'Le statut doit être BROUILLON, EN_VALIDATION, VALIDE, REFUSE ou SIGNE',
  })
  @IsNotEmpty()
  statut: DocumentStatut;

  @ApiProperty({
    example: 'Motif de la modification du statut ou du refus',
    description: 'Commentaire ou motif associé au changement de statut',
    required: false,
  })
  @IsString()
  @IsOptional()
  motif?: string;
}
