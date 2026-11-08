import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DocumentType } from '../../common/enums/document-type.enum';
import { DocumentStatut } from '../../common/enums/document-statut.enum';

export class FilterDocumentsDto {
  @ApiPropertyOptional({
    example: 'proj-8912-tech',
    description: 'Filtrer par identifiant du projet',
  })
  @IsString()
  @IsOptional()
  projetId?: string;

  @ApiPropertyOptional({
    enum: DocumentType,
    example: DocumentType.STATUTS,
    description: 'Filtrer par type de document juridique',
  })
  @IsEnum(DocumentType)
  @IsOptional()
  type?: DocumentType;

  @ApiPropertyOptional({
    enum: DocumentStatut,
    example: DocumentStatut.EN_VALIDATION,
    description: 'Filtrer par statut',
  })
  @IsEnum(DocumentStatut)
  @IsOptional()
  statut?: DocumentStatut;
}
